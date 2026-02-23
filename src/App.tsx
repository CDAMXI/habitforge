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
  const [newHabitEmoji, setNewHabitEmoji] = useState("✨");
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

  const addHabit = async (name: string, emoji = "✨", color = "#007AFF") => {
    try {
      // If emoji is default, try to get a better one from AI
      let finalEmoji = emoji;
      if (emoji === "✨" && name) {
        try {
          const suggestions = await suggestHabits(`Pick one emoji for the habit: ${name}`);
          if (suggestions && suggestions[0]) {
            finalEmoji = suggestions[0].emoji;
          }
        } catch (e) {
          console.error("Failed to auto-pick emoji", e);
        }
      }

      await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, emoji: finalEmoji, color })
      });
      await fetchHabits();
      setShowAddModal(false);
      setNewHabitName("");
      setNewHabitEmoji("✨");
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
        await addHabit(s.name, s.emoji, s.color);
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
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 text-2xl",
                habit.completedToday 
                  ? "bg-[#34C759] text-white shadow-lg shadow-green-500/20 scale-105" 
                  : "bg-[#F2F2F7] grayscale opacity-70"
              )}
            >
              {habit.completedToday ? <Check size={24} strokeWidth={3} /> : habit.emoji || "✨"}
            </button>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {!habit.completedToday && <span className="text-lg">{habit.emoji}</span>}
                <h4 className={cn("font-bold text-[#1C1C1E] transition-all", habit.completedToday && "text-[#8E8E93] line-through opacity-50")}>
                  {habit.name}
                </h4>
              </div>
              <p className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-widest mt-0.5">Daily Streak: 1</p>
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

      {/* AI Section - Improved Design */}
      <section className="mt-12 mb-8">
        <div className="flex items-center gap-2 mb-4 px-1">
          <Sparkles className="text-[#007AFF]" size={20} />
          <h3 className="text-xl font-bold text-[#1C1C1E]">AI Habit Architect</h3>
        </div>
        <div className="apple-card p-6 bg-white shadow-xl shadow-blue-500/5 border border-blue-100/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
              <Wand2 className="text-[#007AFF]" size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1C1C1E]">Personalized Routine</p>
              <p className="text-xs text-[#8E8E93]">Describe your goals to get started.</p>
            </div>
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder="e.g. 'I want to be more mindful and healthy'"
              value={aiGoals}
              onChange={(e) => setAiGoals(e.target.value)}
              className="w-full bg-[#F2F2F7] border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-[#007AFF] outline-none transition-all placeholder:text-[#8E8E93]/50"
            />
            <button 
              onClick={handleAiSuggest}
              disabled={aiSuggesting || !aiGoals}
              className="absolute right-2 top-2 bottom-2 bg-[#007AFF] text-white px-4 rounded-xl disabled:opacity-50 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {aiSuggesting ? <Loader2 className="animate-spin" size={18} /> : (
                <>
                  <span className="text-xs font-bold uppercase tracking-widest">Generate</span>
                  <ChevronRight size={16} />
                </>
              )}
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
              className="apple-card w-full max-w-sm p-8 relative z-10 bg-white shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6 text-center">New Habit</h3>
              
              <div className="flex flex-col gap-4 mb-8">
                <div>
                  <label className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest ml-1 mb-1 block">Habit Name</label>
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="e.g. Morning Yoga"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    className="w-full bg-[#F2F2F7] border-none rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-[#007AFF] font-medium"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest ml-1 mb-1 block">Emoji Icon</label>
                  <input 
                    type="text" 
                    placeholder="✨"
                    value={newHabitEmoji}
                    onChange={(e) => setNewHabitEmoji(e.target.value)}
                    className="w-full bg-[#F2F2F7] border-none rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-[#007AFF] text-2xl text-center"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 font-bold text-[#8E8E93] bg-[#F2F2F7] rounded-2xl active:scale-95 transition-transform"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => addHabit(newHabitName, newHabitEmoji)}
                  disabled={!newHabitName}
                  className="flex-1 py-4 font-bold text-white bg-[#007AFF] rounded-2xl disabled:opacity-50 shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
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
      <nav className="fixed bottom-0 left-0 right-0 apple-blur border-t border-[#8E8E93]/10 px-8 pt-4 pb-8 flex justify-around items-center z-40">
        <button className="text-[#007AFF] flex flex-col items-center gap-1.5">
          <Calendar size={26} strokeWidth={2.5} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Today</span>
        </button>
        <button className="text-[#8E8E93] flex flex-col items-center gap-1.5 opacity-60">
          <TrendingUp size={26} strokeWidth={2} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Stats</span>
        </button>
        <button className="text-[#8E8E93] flex flex-col items-center gap-1.5 opacity-60">
          <Settings size={26} strokeWidth={2} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Settings</span>
        </button>
      </nav>
    </div>
  );
}
