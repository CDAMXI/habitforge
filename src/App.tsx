import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Check, 
  Trophy, 
  Sparkles, 
  Trash2, 
  Camera, 
  X, 
  ChevronRight,
  TrendingUp,
  Calendar,
  Settings,
  Image as ImageIcon,
  Wand2,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Habit, HabitWithStatus, Completion } from "./types";
import { suggestHabits, getMotivation, editProofImage } from "./services/gemini";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [aiGoals, setAiGoals] = useState("");
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [motivation, setMotivation] = useState("");
  const [editingImage, setEditingImage] = useState<{habitId: number, url: string} | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditingImage, setIsEditingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHabits();
  }, []);

  const fetchHabits = async () => {
    try {
      const res = await fetch("/api/habits");
      const data = await res.json();
      const habitsWithStatus = data.habits.map((h: Habit) => ({
        ...h,
        completedToday: data.completions.some((c: Completion) => c.habit_id === h.id),
        proofImageUrl: data.completions.find((c: Completion) => c.habit_id === h.id)?.proof_image_url
      }));
      setHabits(habitsWithStatus);
    } catch (err) {
      console.error("Failed to fetch habits", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleHabit = async (habitId: number) => {
    try {
      const res = await fetch("/api/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habit_id: habitId, date: new Date().toISOString().split('T')[0] })
      });
      const data = await res.json();
      
      setHabits(prev => prev.map(h => 
        h.id === habitId ? { ...h, completedToday: data.status === "completed" } : h
      ));

      if (data.status === "completed") {
        const habit = habits.find(h => h.id === habitId);
        if (habit) {
          const quote = await getMotivation(habit.name);
          setMotivation(quote || "");
        }
      }
    } catch (err) {
      console.error("Failed to toggle habit", err);
    }
  };

  const addHabit = async (name: string, icon = "Circle", color = "#007AFF") => {
    try {
      await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon, color })
      });
      fetchHabits();
      setShowAddModal(false);
      setNewHabitName("");
    } catch (err) {
      console.error("Failed to add habit", err);
    }
  };

  const deleteHabit = async (id: number) => {
    try {
      await fetch(`/api/habits/${id}`, { method: "DELETE" });
      fetchHabits();
    } catch (err) {
      console.error("Failed to delete habit", err);
    }
  };

  const handleAiSuggest = async () => {
    if (!aiGoals) return;
    setAiSuggesting(true);
    try {
      const suggestions = await suggestHabits(aiGoals);
      for (const s of suggestions) {
        await addHabit(s.name, s.icon, s.color);
      }
      setAiGoals("");
    } catch (err) {
      console.error("AI suggestion failed", err);
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, habitId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditingImage({ habitId, url: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleEditImage = async () => {
    if (!editingImage || !editPrompt) return;
    setIsEditingImage(true);
    try {
      const editedUrl = await editProofImage(editingImage.url, editPrompt);
      if (editedUrl) {
        // Save the edited image as proof
        await fetch("/api/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            habit_id: editingImage.habitId, 
            date: new Date().toISOString().split('T')[0],
            proof_image_url: editedUrl 
          })
        });
        setEditingImage(null);
        setEditPrompt("");
        fetchHabits();
      }
    } catch (err) {
      console.error("Image editing failed", err);
    } finally {
      setIsEditingImage(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen p-6 pb-24 font-sans">
      {/* Header */}
      <header className="flex justify-between items-end mb-8 pt-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HabitFlow</h1>
          <p className="text-apple-gray font-medium">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="w-10 h-10 bg-apple-blue text-white rounded-full flex items-center justify-center shadow-lg shadow-apple-blue/20 active:scale-95 transition-transform"
        >
          <Plus size={24} />
        </button>
      </header>

      {/* Progress Card */}
      <section className="apple-card p-6 mb-8 bg-gradient-to-br from-apple-blue to-blue-600 text-white">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-white/70 text-sm font-semibold uppercase tracking-wider">Today's Progress</p>
            <h2 className="text-4xl font-bold mt-1">
              {habits.length > 0 ? Math.round((habits.filter(h => h.completedToday).length / habits.length) * 100) : 0}%
            </h2>
          </div>
          <Trophy className="text-white/30" size={48} />
        </div>
        <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${habits.length > 0 ? (habits.filter(h => h.completedToday).length / habits.length) * 100 : 0}%` }}
            className="bg-white h-full"
          />
        </div>
        <p className="mt-4 text-sm text-white/80 font-medium">
          {habits.filter(h => h.completedToday).length} of {habits.length} habits completed
        </p>
      </section>

      {/* Motivation Toast */}
      <AnimatePresence>
        {motivation && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="apple-card p-4 mb-6 bg-apple-green text-white flex items-center gap-3 shadow-apple-green/20"
          >
            <Sparkles size={20} />
            <p className="font-medium text-sm flex-1">{motivation}</p>
            <button onClick={() => setMotivation("")}><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Habits List */}
      <section className="space-y-4">
        <h3 className="text-xl font-semibold mb-4 px-1">Your Habits</h3>
        {habits.length === 0 && !loading && (
          <div className="apple-card p-8 text-center border-2 border-dashed border-apple-gray/20 bg-transparent">
            <p className="text-apple-gray font-medium">No habits yet. Start by adding one or let AI help you!</p>
          </div>
        )}
        
        {habits.map((habit) => (
          <motion.div 
            layout
            key={habit.id}
            className="apple-card p-4 flex items-center gap-4 group"
          >
            <button 
              onClick={() => toggleHabit(habit.id)}
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300",
                habit.completedToday 
                  ? "bg-apple-green text-white shadow-lg shadow-apple-green/20" 
                  : "bg-apple-bg text-apple-gray"
              )}
            >
              {habit.completedToday ? <Check size={24} /> : <div className="w-6 h-6 border-2 border-apple-gray/30 rounded-full" />}
            </button>
            
            <div className="flex-1">
              <h4 className={cn("font-semibold transition-all", habit.completedToday && "text-apple-gray line-through opacity-50")}>
                {habit.name}
              </h4>
              <p className="text-xs text-apple-gray font-medium uppercase tracking-tighter">Daily</p>
            </div>

            <div className="flex items-center gap-2">
              {habit.proofImageUrl ? (
                <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-apple-bg">
                  <img src={habit.proofImageUrl} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setEditingImage({ habitId: habit.id, url: habit.proofImageUrl! })}
                      className="text-white"
                    >
                      <Wand2 size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => handleImageUpload(e as any, habit.id);
                    input.click();
                  }}
                  className="p-2 text-apple-gray hover:text-apple-blue transition-colors"
                >
                  <Camera size={20} />
                </button>
              )}
              <button 
                onClick={() => deleteHabit(habit.id)}
                className="p-2 text-apple-gray hover:text-apple-red transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </motion.div>
        ))}
      </section>

      {/* AI Section */}
      <section className="mt-12">
        <div className="flex items-center gap-2 mb-4 px-1">
          <Sparkles className="text-apple-blue" size={20} />
          <h3 className="text-xl font-semibold">AI Assistant</h3>
        </div>
        <div className="apple-card p-6 bg-white/50 border border-white">
          <p className="text-sm text-apple-gray font-medium mb-4">
            Tell me your goals, and I'll suggest a personalized habit routine for you.
          </p>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="e.g. Get fit and read more"
              value={aiGoals}
              onChange={(e) => setAiGoals(e.target.value)}
              className="flex-1 bg-apple-bg border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-apple-blue outline-none"
            />
            <button 
              onClick={handleAiSuggest}
              disabled={aiSuggesting || !aiGoals}
              className="bg-apple-blue text-white p-3 rounded-xl disabled:opacity-50 active:scale-95 transition-transform"
            >
              {aiSuggesting ? <Loader2 className="animate-spin" size={20} /> : <ChevronRight size={20} />}
            </button>
          </div>
        </div>
      </section>

      {/* Add Habit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="apple-card w-full max-w-sm p-6 relative z-10"
            >
              <h3 className="text-xl font-bold mb-4">New Habit</h3>
              <input 
                autoFocus
                type="text" 
                placeholder="Habit name"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                className="w-full bg-apple-bg border-none rounded-xl px-4 py-3 mb-6 outline-none focus:ring-2 focus:ring-apple-blue"
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 font-semibold text-apple-gray bg-apple-bg rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => addHabit(newHabitName)}
                  disabled={!newHabitName}
                  className="flex-1 py-3 font-semibold text-white bg-apple-blue rounded-xl disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Editor Modal (Nano Banana) */}
      <AnimatePresence>
        {editingImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="apple-card w-full max-w-md overflow-hidden relative z-10"
            >
              <div className="relative aspect-square bg-black">
                <img src={editingImage.url} className="w-full h-full object-contain" />
                <button 
                  onClick={() => setEditingImage(null)}
                  className="absolute top-4 right-4 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="text-apple-blue" size={18} />
                  <h3 className="font-bold">AI Image Editor</h3>
                </div>
                <p className="text-sm text-apple-gray mb-4">
                  Describe how you want to transform this proof. (e.g. "Add a retro filter", "Make it look like a victory poster")
                </p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Enter prompt..."
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className="flex-1 bg-apple-bg border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-apple-blue"
                  />
                  <button 
                    onClick={handleEditImage}
                    disabled={isEditingImage || !editPrompt}
                    className="bg-apple-blue text-white px-4 py-3 rounded-xl disabled:opacity-50"
                  >
                    {isEditingImage ? <Loader2 className="animate-spin" size={20} /> : "Apply"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 apple-blur border-t border-apple-gray/10 px-8 py-4 flex justify-around items-center z-40">
        <button className="text-apple-blue flex flex-col items-center gap-1">
          <Calendar size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Today</span>
        </button>
        <button className="text-apple-gray flex flex-col items-center gap-1">
          <TrendingUp size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Stats</span>
        </button>
        <button className="text-apple-gray flex flex-col items-center gap-1">
          <Settings size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Settings</span>
        </button>
      </nav>
    </div>
  );
}
