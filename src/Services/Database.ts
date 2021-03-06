import { getAuth } from '@firebase/auth';
import { initializeApp } from "@firebase/app";
import {
    addDoc, collection, DocumentReference, getDocs, getFirestore,
    limit, query, updateDoc, where, setDoc, doc, getDoc, orderBy, deleteDoc,
    DocumentData, QueryDocumentSnapshot, Firestore, connectFirestoreEmulator
} from "@firebase/firestore";
import { findIndex } from "lodash";
import {
    PatientChart, PatientNotFoundError, Medication, Settings
} from "nurse-o-core"
import { Cache } from './Cache';

import {$patient} from "./State"

export class Database {
    // eslint-disable-next-line no-use-before-define
    private static instance: Database;
    // private patient: PatientChart;
    private db: Firestore;
    private patientDocRef: DocumentReference | null;
    private currentPatientID: string | null | undefined;
    private cache: Cache;
    private medListCached: boolean;
    private patientListCached: boolean;

    constructor(firebaseConfig: any) {
        initializeApp(firebaseConfig);
        this.db = getFirestore();
        connectFirestoreEmulator(this.db, "localhost", 8080);
        this.patientDocRef = null;
        this.currentPatientID = null;
        this.cache = new Cache();
        this.medListCached = false;
        this.patientListCached = false;
    }

    async getPatient(id: string): Promise<boolean> {
        const uid = getAuth().currentUser?.uid;
        let patientChart: PatientChart;
        if (!uid) return false;

        if (this.currentPatientID === $patient.value?.id) return true;

        console.log("getting patient info from db")
        const q = query(collection(this.db, "patients"), where("id", "==", id), where("studentUID", "==", uid), limit(1))
        const doc = (await getDocs(q)).docs[0]
        if (doc) {
            this.patientDocRef = doc.ref;
            patientChart = doc.data() as PatientChart;
        } else {
            const templatePatientQuery = query(collection(this.db, "templatePatients"), where("id", "==", id), limit(1))
            const templatePatientDoc = (await getDocs(templatePatientQuery)).docs[0];
            if (!templatePatientDoc) return false;
            patientChart = templatePatientDoc.data() as PatientChart;
            patientChart.studentUID = uid;
            this.patientDocRef = await this.addPatient(patientChart);
            this.currentPatientID = patientChart?.id;

        }
        $patient.next(patientChart)
        console.log(patientChart)
        return true;

    }

    async updatePatient() {
        if (this.patientDocRef === null) {
            console.error("Patient not found")
        } else {
            const patient = { ...$patient.value };
            await updateDoc(this.patientDocRef, patient);
        }
    }

    async addPatient(patient: PatientChart) {
        return await addDoc(collection(this.db, "patients"), patient);
    }

    async addMedication(medication: Medication) {
        this.medListCached = false;
        const medicationCollection = collection(this.db, "medications");
        const document = doc(medicationCollection);
        medication.id = document.id;
        await addDoc(collection(this.db, "medications"), medication);
    }

    async getMedications(): Promise<Medication[]> {
        if (this.medListCached) {
            const cachedMeds = this.cache.getMeds();
            return cachedMeds;
        }
        console.log("getting medications from db")
        const q = query(collection(this.db, "medications"), orderBy("name"));
        const docs = (await getDocs(q)).docs
        const medications = docs.map(doc => doc.data()) as Medication[];
        this.cache.cacheMultipleMeds(medications);
        return medications;
    }

    async getMedication(id: string): Promise<Medication | null> {
        if (this.medListCached) {
            const cachedMeds = this.cache.getMeds();
            const medIndex = findIndex(cachedMeds, { id })
            if (medIndex > -1) return cachedMeds[medIndex]
        }

        console.log("getting medication from db")
        const q = query(collection(this.db, "medications"), where("id", "==", id), limit(1));
        const docs = (await getDocs(q)).docs
        if (docs.length === 0) return null;

        const medication = docs[0].data() as Medication
        this.cache.cacheMed(medication)
        return medication;
    }

    async getMedicationDoc(medID?: string, barcode?: string) {
        let q;
        if (medID) {
            q = query(collection(this.db, "medications"), where("id", "==", medID), limit(1))
        } else if (barcode) {
            q = query(collection(this.db, "medications"), where("barcode", "==", barcode), limit(1))
        } else {
            throw new Error("Please provide either medID or barcode ID")
        }
        const doc = (await getDocs(q)).docs[0]
        return doc;
    }

    async updateMedication(med: Medication) {
        console.log(med.id)
        const doc = await this.getMedicationDoc(med.id);
        const ref = doc.ref;
        updateDoc(ref, { ...med });
    }

    async removeMedication(medID: string) {
        const doc = await this.getMedicationDoc(medID);
        await deleteDoc(doc.ref);
        this.medListCached = false;
    }



    async getSettings() {
        const cachedSettings = this.cache.getSettings();
        if (cachedSettings) return cachedSettings;
        const settingsRef = doc(this.db, "settings", "settings");
        const document = await getDoc(settingsRef);
        const data = document.data() as Settings;
        this.cache.cacheSettings(data);
        return data;
    }

    async saveSettings(setting: Settings) {
        const settingsRef = doc(this.db, "settings", "settings");
        await setDoc(settingsRef, setting);
    }

    // async updateSettings() {
    //     const settingsRef = doc(this.db, "settings", "settings");
    //     await updateDoc(settingsRef, $settings.value);
    // }





    async addTemplatePatient(patient: PatientChart) {
        this.patientListCached = false;
        await addDoc(collection(this.db, "templatePatients"), patient);
    }

    async getTemplatePatients(): Promise<PatientChart[]> {
        if (this.patientListCached) {
            const patients = this.cache.getPatients();
            return patients;
        }
        console.log("getting template patients from db")
        const q = query(collection(this.db, "templatePatients"), orderBy("name"));
        const docs = (await getDocs(q)).docs
        if (docs.length === 0) return [];
        const patients = docs.map(doc => doc.data()) as PatientChart[];
        this.cache.cacheMultiplePatients(patients);
        this.patientListCached = true;
        return patients;
    }

    async deleteTemplatePatient(patient: PatientChart) {
        const ref = await this.getTemplatePatientRef(patient);
        await deleteDoc(ref);
        this.patientListCached = false;
    }

    async updateTemplatePatient(oldPatient: PatientChart, newPatient: PatientChart) {
        const ref = await this.getTemplatePatientRef(oldPatient);
        const patient = { ...newPatient };
        this.patientListCached = false;
        await updateDoc(ref, patient);
    }

    private async getTemplatePatientRef(patient: PatientChart): Promise<DocumentReference> {
        const patientQuery = query(collection(this.db, "templatePatients"), where("id", "==", patient.id), limit(1))
        const document = (await getDocs(patientQuery)).docs[0];
        return document.ref;
    }

    async getAdminList(): Promise<string[]> {
        const q = query(collection(this.db, "Admins"), limit(1));
        const doc = (await getDocs(q)).docs[0];
        if (doc) {
            return doc.data().adminEmails as string[]
        } else {
            return []
        }
    }

    async updateAdminList(updatedAdmins: string[]) {
        const q = query(collection(this.db, "Admins"), limit(1));
        const doc = (await getDocs(q)).docs[0];
        const data = {
            adminEmails: updatedAdmins
        }
        updateDoc(doc.ref, data);
    }






    public static getInstance(): Database {
        if (Database.instance) {
            return Database.instance;
        } else {
            throw new Error("Can't get an instance without initializing first")
        }

    }

    public static initialize(firebaseConfig: any) {
        if (!Database.instance) {
            Database.instance = new Database(firebaseConfig);
        }
        return Database.instance;
    }
}