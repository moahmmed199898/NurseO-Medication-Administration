import { useState } from 'react';
import PureModal from "react-pure-modal"
import { Medication, MedicationLocation } from "nurse-o-core"
import { VerifyPopup } from './VerifyPopup';

type Props = {
    med: Medication,
    onClose: () => void
}

export function MedLocationModal(props: Props) {


    const [locationToBeVerified, setLocationToBeVerified] = useState<MedicationLocation | null>(null)


    const onMedVerified = () => {
        setLocationToBeVerified(null)
        props.onClose();
    }


    return (
        <PureModal width='60vw' header="Order" isOpen={true} onClose={props.onClose}>
            <div>
                <h1 className='font-bold text-lg py-2 text-red-700 text-center'>
                    Acetaminophen 10mg/kg PO q7hr PRN
                </h1>

                {props.med.locations.length > 0 ?
                    <table className='w-full m-auto'>
                        <thead>
                            <tr className='text-left h-10'>
                                <th className='pl-5'>Medication</th>
                                <th className='pl-5'>Type</th>
                                <th className='pl-5'>Dose</th>
                                <th>Drawer</th>
                                <th>Slot</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {props.med.locations.map((location, i) =>
                                <tr key={i} className='h-16 odd:bg-gray-100 even:bg-gray-300 '>
                                    <td className='pl-5'>{props.med.name}</td>
                                    <td className='pl-5'>{location.type.toLocaleUpperCase()}</td>
                                    <td>{location.dose}</td>
                                    <td>{location.drawer}</td>
                                    <td>{location.slot}</td>
                                    <td className='w-36'><button className='bg-red-700 text-white px-10 h-10 rounded-full' onClick={() => setLocationToBeVerified(location)}>Verify</button></td>
                                </tr>
                            )}
                        </tbody>
                    </table> :
                    <h1 className='text-center font-bold py-6'>Medication is not available, please call pharmacy</h1>
                }

                {locationToBeVerified ?
                    <VerifyPopup 
                        med={props.med}
                        location= {locationToBeVerified}
                        onVerified={onMedVerified}
                        onClose={console.log} />
                    : null}

            </div>
        </PureModal>
    );
}
