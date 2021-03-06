import { PatientChart } from "nurse-o-core";
import { BehaviorSubject } from "rxjs";

export const $patient = new BehaviorSubject<PatientChart>(new PatientChart());
export const $providerOrdersAvailable = new BehaviorSubject<boolean>(false);
