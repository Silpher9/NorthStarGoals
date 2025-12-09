import React, { useState } from 'react';
import StarryNight from './components/StarryNight';
import TodoList from './components/TodoList';
import { Todo } from './types';

const App: React.FC = () => {
  const [goals, setGoals] = useState<Todo[]>([]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Top 1/3: Visuals */}
      <div className="h-[33vh] w-full flex-shrink-0 z-10 shadow-2xl shadow-slate-900/50">
        <StarryNight goals={goals} />
      </div>
      
      {/* Bottom 2/3: Functionality */}
      <div className="h-[67vh] w-full flex-grow z-0">
        <TodoList onGoalsChange={setGoals} />
      </div>
    </div>
  );
};

export default App;