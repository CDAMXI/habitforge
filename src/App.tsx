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
  Loader2,
  Sun,
  Moon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Habit, HabitWithStatus, Completion } from "./types";
import { suggestHabits, getMotivation, editProofImage } from "./services/gemini";
import { translations, languages } from "./i18n";
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
  const [activeTab, setActiveTab] = useState<'today' | 'stats' | 'settings'>('today');
  const [lang, setLang] = useState<keyof typeof translations>(() => {
    const saved = localStorage.getItem('lang');
    return (saved as any) || 'en';
  });
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' || 
             window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

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

  const t = translations[lang];

  return (
    <div className="max-w-md mx-auto min-h-screen p-6 pb-24 font-sans bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
      {/* Header */}
      <header className="flex justify-between items-end mb-8 pt-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {activeTab === 'today' ? 'HabitFlow' : activeTab === 'stats' ? t.stats : t.settings}
          </h1>
          <p className="text-[#8E8E93] font-medium">
            {activeTab === 'today' 
              ? new Date().toLocaleDateString(lang, { weekday: 'long', month: 'long', day: 'numeric' })
              : activeTab === 'stats' ? t.stats_overview : t.appearance}
          </p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'today' && (
            <>
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className="w-10 h-10 bg-[var(--card-bg)] text-[var(--text-primary)] rounded-full flex items-center justify-center shadow-lg border border-[var(--card-border)] active:scale-95 transition-all"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button 
                onClick={() => setShowAddModal(true)}
                className="w-10 h-10 bg-[#007AFF] text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
              >
                <Plus size={24} />
              </button>
            </>
          )}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeTab === 'today' && (
          <motion.div
            key="today"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            {/* Habits List */}
            <section className="space-y-4">
              <h3 className="text-xl font-semibold mb-4 px-1">{t.habits}</h3>
              {habits.length === 0 && !loading && (
                <div className="apple-card p-8 text-center border-2 border-dashed border-apple-gray/20 bg-transparent">
                  <p className="text-apple-gray font-medium">{t.no_habits}</p>
                  <p className="text-xs text-apple-gray/60 mt-1">{t.no_habits_desc}</p>
                </div>
              )}
              
              {habits.map((habit) => (
                <motion.div 
                  layout
                  key={habit.id}
                  className="apple-card p-4 flex items-center gap-4 group bg-[var(--card-bg)] border-[var(--card-border)]"
                >
                  <button 
                    onClick={() => toggleHabit(habit.id)}
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 text-2xl",
                      habit.completedToday 
                        ? "bg-[#34C759] text-white shadow-lg shadow-green-500/20 scale-105" 
                        : "bg-[var(--bg-primary)] grayscale opacity-70"
                    )}
                  >
                    {habit.completedToday ? <Check size={24} strokeWidth={3} /> : habit.emoji || "✨"}
                  </button>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {!habit.completedToday && <span className="text-lg">{habit.emoji}</span>}
                      <h4 className={cn("font-bold text-[var(--text-primary)] transition-all", habit.completedToday && "text-[#8E8E93] line-through opacity-50")}>
                        {habit.name}
                      </h4>
                    </div>
                    <p className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-widest mt-0.5">{t.streak}: 1</p>
                  </div>

                  <div className="flex items-center gap-1">
                    {habit.proofImageUrl ? (
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-[var(--bg-primary)] shadow-sm">
                        <img src={habit.proofImageUrl} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingImage({ habitId: habit.id, url: habit.proofImageUrl! })}
                            className="text-white p-1.5 bg-white/20 rounded-full backdrop-blur-sm"
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
                        className="p-2 text-[#8E8E93] hover:text-[#007AFF] hover:bg-blue-500/10 rounded-full transition-all"
                      >
                        <Camera size={20} />
                      </button>
                    )}
                    <button 
                      onClick={() => deleteHabit(habit.id)}
                      className="p-2 text-[#8E8E93] hover:text-[#FF3B30] hover:bg-red-500/10 rounded-full transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </section>

            {/* AI Section */}
            <section className="mt-12 mb-8">
              <div className="flex items-center gap-2 mb-4 px-1">
                <Sparkles className="text-[#007AFF]" size={20} />
                <h3 className="text-xl font-bold text-[var(--text-primary)]">{t.ai_architect}</h3>
              </div>
              <div className="apple-card p-6 bg-[var(--card-bg)] shadow-xl shadow-blue-500/5 border border-[var(--card-border)]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                    <Wand2 className="text-[#007AFF]" size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{t.personalized_routine}</p>
                    <p className="text-xs text-[#8E8E93]">{t.describe_goals}</p>
                  </div>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="..."
                    value={aiGoals}
                    onChange={(e) => setAiGoals(e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-[#007AFF] outline-none transition-all placeholder:text-[#8E8E93]/50 text-[var(--text-primary)]"
                  />
                  <button 
                    onClick={handleAiSuggest}
                    disabled={aiSuggesting || !aiGoals}
                    className="absolute right-2 top-2 bottom-2 bg-[#007AFF] text-white px-4 rounded-xl active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                  >
                    {aiSuggesting ? <Loader2 className="animate-spin" size={18} /> : (
                      <>
                        <span className="text-xs font-bold uppercase tracking-widest">{t.generate}</span>
                        <ChevronRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="apple-card p-5 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none">
                <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">{t.completion_rate}</p>
                <p className="text-3xl font-bold">84%</p>
              </div>
              <div className="apple-card p-5 bg-gradient-to-br from-green-500 to-green-600 text-white border-none">
                <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">{t.best_streak}</p>
                <p className="text-3xl font-bold">12</p>
              </div>
            </div>

            <div className="apple-card p-6">
              <h4 className="font-bold mb-4">{t.habits_performance}</h4>
              <div className="space-y-4">
                {habits.map(h => (
                  <div key={h.id} className="flex items-center gap-3">
                    <span className="text-xl">{h.emoji}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span>{h.name}</span>
                        <span>75%</span>
                      </div>
                      <div className="w-full bg-[var(--bg-primary)] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#007AFF] h-full w-3/4 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="apple-card overflow-hidden">
              <div className="p-4 border-b border-[var(--tab-border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-apple-gray/10 rounded-lg flex items-center justify-center">
                    <Moon size={18} className="text-apple-gray" />
                  </div>
                  <span className="font-medium">{t.dark_mode}</span>
                </div>
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    darkMode ? "bg-apple-green" : "bg-apple-gray/20"
                  )}
                >
                  <motion.div 
                    animate={{ x: darkMode ? 24 : 2 }}
                    className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>

              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-apple-blue/10 rounded-lg flex items-center justify-center">
                    <ImageIcon size={18} className="text-apple-blue" />
                  </div>
                  <span className="font-medium">{t.language}</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setLang(l.code as any)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl transition-all",
                        lang === l.code ? "bg-apple-blue/10 text-apple-blue font-bold" : "hover:bg-apple-gray/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{l.flag}</span>
                        <span>{l.name}</span>
                      </div>
                      {lang === l.code && <Check size={18} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="apple-card w-full max-w-sm p-8 relative z-10 bg-[var(--card-bg)] border-[var(--card-border)] shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6 text-center text-[var(--text-primary)]">{t.add_habit}</h3>
              
              <div className="flex flex-col gap-4 mb-8">
                <div>
                  <label className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest ml-1 mb-1 block">{t.habit_name}</label>
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="e.g. Morning Yoga"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border-none rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-[#007AFF] font-medium text-[var(--text-primary)]"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest ml-1 mb-1 block">{t.emoji_icon}</label>
                  <input 
                    type="text" 
                    placeholder="✨"
                    value={newHabitEmoji}
                    onChange={(e) => setNewHabitEmoji(e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border-none rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-[#007AFF] text-2xl text-center text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 font-bold text-[#8E8E93] bg-[var(--bg-primary)] rounded-2xl active:scale-95 transition-transform"
                >
                  {t.cancel}
                </button>
                <button 
                  onClick={() => addHabit(newHabitName, newHabitEmoji)}
                  disabled={!newHabitName}
                  className="flex-1 py-4 font-bold text-white bg-[#007AFF] rounded-2xl disabled:opacity-50 shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
                >
                  {t.create}
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
              className="apple-card w-full max-w-md overflow-hidden relative z-10 bg-[var(--card-bg)] border-[var(--card-border)] shadow-2xl"
            >
              <div className="relative aspect-square bg-[#1C1C1E]">
                <img src={editingImage.url} className="w-full h-full object-contain" />
                <button 
                  onClick={() => setEditingImage(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                    <Wand2 className="text-[#007AFF]" size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-[var(--text-primary)]">{t.ai_magic_editor}</h3>
                </div>
                <p className="text-sm text-[#8E8E93] mb-6 leading-relaxed">
                  {t.magic_desc}
                </p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="..."
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className="flex-1 bg-[var(--bg-primary)] border-none rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[#007AFF] transition-all text-[var(--text-primary)]"
                  />
                  <button 
                    onClick={handleEditImage}
                    disabled={isEditingImage || !editPrompt}
                    className="bg-[#007AFF] text-white px-6 py-4 rounded-2xl disabled:opacity-50 font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    {isEditingImage ? <Loader2 className="animate-spin" size={20} /> : t.magic}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 apple-blur border-t border-[var(--tab-border)] px-8 pt-4 pb-8 flex justify-around items-center z-40">
        <button 
          onClick={() => setActiveTab('today')}
          className={cn("flex flex-col items-center gap-1.5 transition-all", activeTab === 'today' ? "text-[#007AFF]" : "text-[#8E8E93] opacity-60")}
        >
          <Calendar size={26} strokeWidth={activeTab === 'today' ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t.today}</span>
        </button>
        <button 
          onClick={() => setActiveTab('stats')}
          className={cn("flex flex-col items-center gap-1.5 transition-all", activeTab === 'stats' ? "text-[#007AFF]" : "text-[#8E8E93] opacity-60")}
        >
          <TrendingUp size={26} strokeWidth={activeTab === 'stats' ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t.stats}</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn("flex flex-col items-center gap-1.5 transition-all", activeTab === 'settings' ? "text-[#007AFF]" : "text-[#8E8E93] opacity-60")}
        >
          <Settings size={26} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t.settings}</span>
        </button>
      </nav>
    </div>
  );
}
