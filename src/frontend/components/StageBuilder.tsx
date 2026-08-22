import React, { useState } from 'react';
import { Plus, Trash, Code } from '@phosphor-icons/react';

type StageType = 'Input' | 'ClickHouseQueryStream';

interface Stage {
  id: string;
  type: StageType;
  source: string;
  transformation: string;
}

export default function StageBuilder() {
  const [stages, setStages] = useState<Stage[]>([]);

  const addStage = () => {
    const newStage: Stage = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'Input',
      source: '',
      transformation: '(data) => data',
    };
    setStages([...stages, newStage]);
  };

  const updateStage = (id: string, field: keyof Stage, value: string) => {
    setStages(stages.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeStage = (id: string) => {
    setStages(stages.filter(s => s.id !== id));
  };

  return (
    <div className="space-y-4">
      <p className='text-[10px]'>Paragon uses stages to process data. Each stage can transform or filter data before passing it to the next stage.</p>
    </div>
  );
}
