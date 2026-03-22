import { useState } from 'react';
import UploadForm from './components/UploadForm';
import Configuration from './components/Configuration';
import ResultsDashboard from './components/ResultsDashboard';

export default function App() {
  const [step, setStep] = useState(1);
  const [dataInfo, setDataInfo] = useState(null);
  const [resultsData, setResultsData] = useState(null);

  const handleUploadSuccess = (data) => {
    setDataInfo(data);
    setStep(2);
  };

  const handleTrainSuccess = (data) => {
    setResultsData(data);
    setStep(3);
  };

  const handleRestart = () => {
    setStep(1);
    setDataInfo(null);
    setResultsData(null);
  };

  return (
    <>
      <header className="app-header">
        <h1 className="app-title">AutoML Platform</h1>
      </header>

      <main className="app-main">
        {step === 1 && <UploadForm onUploadSuccess={handleUploadSuccess} />}
        {step === 2 && <Configuration dataInfo={dataInfo} onTrainStart={handleTrainSuccess} />}
        {step === 3 && <ResultsDashboard resultsData={resultsData} onRestart={handleRestart} />}
      </main>
    </>
  );
}
