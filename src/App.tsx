import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Users, 
  Timer, 
  TrendingUp, 
  ChevronRight, 
  ArrowLeft,
  Search,
  Trophy,
  Award,
  ChevronDown,
  LogOut,
  Camera,
  Mail,
  Lock,
  User as UserIcon,
  Github,
  School,
  Settings,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut, 
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  User
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  addDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';

// --- Types & Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Athlete {
  id: string;
  name: string;
  age: number;
  sport: string;
  profilePicUrl?: string;
}

interface Trial {
  id: string;
  trialType: string;
  unit: string;
  value: number;
  date: string;
}

interface Teacher {
  name: string;
  email: string;
  schoolName?: string;
  profilePicUrl?: string;
}

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [teacherData, setTeacherData] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'profile' | 'logger' | 'leaderboard' | 'settings'>('dashboard');
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedAthlete = athletes.find(a => a.id === selectedAthleteId);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // Update handleFirestoreError to also set local state if possible or just wrap calls
  const safeAsync = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const teacherRef = doc(db, `teachers/${user.uid}`);
    const unsubscribe = onSnapshot(teacherRef, (docSnap) => {
      if (docSnap.exists()) {
        setTeacherData(docSnap.data() as Teacher);
      } else {
        // Auto-initialize profile if missing
        safeAsync(async () => {
          await setDoc(teacherRef, {
            email: user.email || '',
            name: user.displayName || 'Coach',
            createdAt: serverTimestamp()
          });
        });
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, `teachers/${user.uid}`);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAthletes([]);
      return;
    }

    const athletesPath = `teachers/${user.uid}/athletes`;
    const q = query(collection(db, athletesPath), orderBy('name'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const athleteList: Athlete[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Athlete));
      setAthletes(athleteList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, athletesPath);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddAthlete = async (name: string, age: number, sport: string, picUrl: string) => {
    if (!user) return;
    const athletesPath = `teachers/${user.uid}/athletes`;
    await safeAsync(async () => {
      await addDoc(collection(db, athletesPath), {
        name,
        age,
        sport,
        profilePicUrl: picUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        createdAt: serverTimestamp()
      });
    });
  };

  const handleUpdateTeacher = async (data: Partial<Teacher>) => {
    if (!user) return;
    const teacherRef = doc(db, `teachers/${user.uid}`);
    await safeAsync(async () => {
      await updateDoc(teacherRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    });
  };

  const handleAddTrial = async (athleteId: string, type: string, value: number, unit: string) => {
    if (!user) return;
    const trialsPath = `teachers/${user.uid}/athletes/${athleteId}/trials`;
    await safeAsync(async () => {
      await addDoc(collection(db, trialsPath), {
        trialType: type,
        value,
        unit,
        timestamp: serverTimestamp(),
        date: new Date().toISOString().split('T')[0]
      });
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-blue-600 font-black"
        >
          SYNCING...
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] font-sans text-slate-900 pb-24">
      <AnimatePresence>
        {errorMsg && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-3 border border-red-500/50"
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="max-w-[250px] truncate">{errorMsg}</span>
            <div className="flex gap-2">
              <button 
                onClick={() => window.location.reload()} 
                className="bg-white/20 px-2 py-1 rounded-lg hover:bg-white/30 transition-colors"
              >
                Reload
              </button>
              <button onClick={() => setErrorMsg(null)} className="hover:opacity-50">×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-slate-900 text-[10px] text-slate-400 py-1.5 px-4 font-mono uppercase tracking-[0.2em] flex justify-between items-center">
        <span>Scout System v3.0 // {user?.uid.slice(0, 8)}...</span>
        <div className="flex items-center gap-4">
          {process.env.NODE_ENV !== 'production' && (
            <span className="text-emerald-500">DB: {db.app.options.projectId}</span>
          )}
          <button onClick={() => signOut(auth)} className="flex items-center gap-1 hover:text-white transition-colors">
            <LogOut className="w-3 h-3" />
            Logout
          </button>
        </div>
      </div>

      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-5 sticky top-0 z-30">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => setView('dashboard')}>
            <h1 className="text-xl font-black tracking-tighter text-slate-900 flex items-center gap-1.5 uppercase italic">
              KREEDA<span className="text-blue-600 font-medium">PRERANA</span>
            </h1>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Grassroots Scout</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setView('leaderboard')}
              className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2 group"
            >
              <Trophy className="w-4 h-4 text-amber-500" />
            </button>
            <button 
              onClick={() => setView('settings')}
              className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl hover:bg-slate-100 transition-all"
            >
              <Settings className="w-4 h-4 text-slate-400" />
            </button>
            <button 
              onClick={() => signOut(auth).then(() => setView('dashboard'))}
              className="bg-red-50 text-red-600 p-2.5 rounded-xl hover:bg-red-100 transition-all shadow-sm"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-5 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <Dashboard 
              athletes={athletes} 
              onSelect={(id) => { setSelectedAthleteId(id); setView('profile'); }}
              onAdd={handleAddAthlete}
              teacher={teacherData}
            />
          )}
          {view === 'profile' && selectedAthlete && (
            <Profile 
              athlete={selectedAthlete} 
              onBack={() => setView('dashboard')}
              onLog={() => setView('logger')}
            />
          )}
          {view === 'logger' && selectedAthlete && (
            <TrialLogger 
              athlete={selectedAthlete}
              onBack={() => setView('profile')}
              onSave={(val) => {
                handleAddTrial(selectedAthlete.id, '100m Sprint', val, 's');
                setView('profile');
              }}
            />
          )}
          {view === 'leaderboard' && (
            <Leaderboard 
              athletes={athletes} 
              onBack={() => setView('dashboard')}
              onSelect={(id) => { setSelectedAthleteId(id); setView('profile'); }}
            />
          )}
          {view === 'settings' && (
            <SettingsView 
              teacher={teacherData} 
              onBack={() => setView('dashboard')} 
              onUpdate={handleUpdateTeacher}
            />
          )}
        </AnimatePresence>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-blue-600 text-white text-[10px] py-2 text-center font-mono uppercase tracking-widest bg-opacity-95 backdrop-blur-md z-40 border-t border-blue-500/30">
        Demo Preview • Firebase Cloud Sync Active
      </div>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        const u = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(u.user, { displayName: name });
        // Create teacher doc
        await setDoc(doc(db, `teachers/${u.user.uid}`), {
          email,
          name,
          createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password. If you are new, please use the SIGNUP tab.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Try logging in.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // Create/Update teacher doc
      await setDoc(doc(db, `teachers/${result.user.uid}`), {
        email: result.user.email,
        name: result.user.displayName,
        profilePicUrl: result.user.photoURL,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-sm space-y-8 bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-100"
      >
        <div className="text-center space-y-4">
          <div className="bg-blue-600 w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Trophy className="w-6 h-6" />
          </div>
          
          <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
            <button 
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'login' ? 'bg-white shadow-sm text-slate-900 border border-slate-100' : 'text-slate-400'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'signup' ? 'bg-white shadow-sm text-slate-900 border border-slate-100' : 'text-slate-400'}`}
            >
              Signup
            </button>
          </div>

          <h2 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900">
            {mode === 'login' ? 'Welcome Back' : 'Join Scout Network'}
          </h2>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {mode === 'signup' && (
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input 
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-50 focus:border-blue-600 focus:bg-white rounded-2xl text-sm transition-all outline-none font-bold"
                placeholder="Full Name"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input 
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-50 focus:border-blue-600 focus:bg-white rounded-2xl text-sm transition-all outline-none font-bold"
              placeholder="Email Address"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input 
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-50 focus:border-blue-600 focus:bg-white rounded-2xl text-sm transition-all outline-none font-bold"
              placeholder="Password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          
          {error && (
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
              <p className="text-[10px] text-red-600 font-bold leading-relaxed uppercase">{error}</p>
            </div>
          )}

          <button 
            disabled={isSubmitting}
            className={`w-full py-5 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all uppercase tracking-widest mt-4 italic flex items-center justify-center gap-2 ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white'}`}
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : mode === 'login' ? 'Authorize' : 'Register'}
          </button>
        </form>

        <div className="space-y-4">
          <div className="flex items-center gap-4 text-slate-300">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] font-black uppercase tracking-widest">or continue with</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>
          
          <button 
            onClick={handleGoogleAuth}
            disabled={isSubmitting}
            className="w-full py-4 border-2 border-slate-50 bg-slate-50 hover:bg-white hover:border-slate-100 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all active:scale-95"
          >
            <Github className="w-5 h-5" />
            <span>Google WorkSpace</span>
          </button>
        </div>

        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
          Cloud Synchronized Database<br/>
          Grassroots Talent Analytics v3.0
        </p>
      </motion.div>
    </div>
  );
}

function SettingsView({ teacher, onBack, onUpdate }: { 
  teacher: Teacher | null, 
  onBack: () => void,
  onUpdate: (d: Partial<Teacher>) => void
}) {
  const [name, setName] = useState(teacher?.name || '');
  const [school, setSchool] = useState(teacher?.schoolName || '');
  const [picUrl, setPicUrl] = useState(teacher?.profilePicUrl || '');

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <button onClick={onBack} className="flex items-center gap-2 group">
        <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900 transition-colors">Back to Dashboard</span>
      </button>

      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative group">
            <div className="w-24 h-24 rounded-[2.5rem] overflow-hidden border-4 border-slate-50 shadow-lg">
              <img 
                src={picUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-blue-600 p-2 rounded-xl text-white shadow-xl">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tighter uppercase italic">{teacher?.name}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{teacher?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Profile Photo URL</label>
            <input 
              className="w-full p-4 bg-slate-50 border-2 border-slate-50 focus:border-blue-600 focus:bg-white rounded-2xl text-sm transition-all outline-none font-bold" 
              placeholder="https://..."
              value={picUrl}
              onChange={e => setPicUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Full Name</label>
            <input 
              className="w-full p-4 bg-slate-50 border-2 border-slate-50 focus:border-blue-600 focus:bg-white rounded-2xl text-sm transition-all outline-none font-bold" 
              placeholder="Your Name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">School / Organization</label>
            <input 
              className="w-full p-4 bg-slate-50 border-2 border-slate-50 focus:border-blue-600 focus:bg-white rounded-2xl text-sm transition-all outline-none font-bold" 
              placeholder="District High School"
              value={school}
              onChange={e => setSchool(e.target.value)}
            />
          </div>
        </div>

        <button 
          onClick={() => {
            onUpdate({ name, schoolName: school, profilePicUrl: picUrl });
            onBack();
          }}
          className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-sm shadow-xl active:scale-95 transition-all uppercase tracking-widest italic"
        >
          Save Changes
        </button>
      </div>
    </motion.div>
  );
}

function Dashboard({ athletes, onSelect, onAdd, teacher }: { 
  athletes: Athlete[], 
  onSelect: (id: string) => void,
  onAdd: (n: string, a: number, s: string, p: string) => void,
  teacher: Teacher | null
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sport, setSport] = useState('');
  const [picUrl, setPicUrl] = useState('');

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      <section className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xl shadow-slate-200/50 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] scale-[4] group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
          <TrendingUp className="w-12 h-12" />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md">
            <img 
              src={teacher?.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${teacher?.email}`} 
              alt="Coach" 
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight uppercase italic">{teacher?.name}</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{teacher?.schoolName || 'Grassroots Coach'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-3xl font-black text-slate-900 tracking-tighter">{athletes.length}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Talents</p>
          </div>
          <div>
            <p className="text-3xl font-black text-blue-600 tracking-tighter">LIVE</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sync Status</p>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Scout List</h2>
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-slate-900 text-white flex items-center gap-2 px-4 py-2 rounded-full hover:bg-blue-600 transition-all text-xs font-bold shadow-lg active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Talent</span>
          </button>
        </div>

        <div className="grid gap-3">
          {athletes.map((athlete, idx) => (
            <motion.div 
              key={athlete.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelect(athlete.id)}
              className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center relative overflow-hidden">
                  <img 
                    src={athlete.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${athlete.name}`} 
                    alt={athlete.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-blue-600/10 transition-colors" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase italic tracking-tighter">{athlete.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black uppercase bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 italic">{athlete.sport}</span>
                    <span className="text-[9px] font-bold text-slate-400">{athlete.age}y</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </motion.div>
          ))}
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 space-y-6 shadow-2xl"
          >
            <div className="space-y-1">
              <h3 className="text-2xl font-black tracking-tighter uppercase italic">Register Talent</h3>
              <p className="text-xs text-slate-400 font-medium tracking-wide">Enter the grassroots student details below.</p>
            </div>
            <div className="space-y-4">
              <div className="flex justify-center mb-2">
                <div className="relative group cursor-pointer" onClick={() => {}}>
                  <div className="w-20 h-20 bg-slate-100 rounded-[1.5rem] border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                    {picUrl ? (
                      <img src={picUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <ImageIcon className="w-6 h-6 text-slate-300" />
                        <span className="text-[8px] font-black text-slate-300 mt-1 uppercase">Athlete Pic</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-blue-600 p-1.5 rounded-lg text-white shadow-lg">
                    <Plus className="w-3 h-3" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Photo URL</label>
                <input 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-50 focus:border-blue-600 focus:bg-white rounded-2xl text-sm transition-all outline-none font-bold" 
                  placeholder="Paste URL (Optional)"
                  value={picUrl}
                  onChange={e => setPicUrl(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Full Name</label>
                <input 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-50 focus:border-blue-600 focus:bg-white rounded-2xl text-sm transition-all outline-none font-bold" 
                  placeholder="e.g. Rahul Verma"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Age</label>
                  <input 
                    className="w-full p-4 bg-slate-50 border-2 border-slate-50 focus:border-blue-600 focus:bg-white rounded-2xl text-sm transition-all outline-none font-bold" 
                    placeholder="12"
                    type="number"
                    value={age}
                    onChange={e => setAge(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Primary Sport</label>
                  <input 
                    className="w-full p-4 bg-slate-50 border-2 border-slate-50 focus:border-blue-600 focus:bg-white rounded-2xl text-sm transition-all outline-none font-bold" 
                    placeholder="Sprinting"
                    value={sport}
                    onChange={e => setSport(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setIsAdding(false)}
                className="flex-1 py-4 text-slate-500 font-bold text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if(!name || !age) return;
                  onAdd(name, parseInt(age), sport || 'Athletics', picUrl);
                  setIsAdding(false);
                  setName(''); setAge(''); setSport(''); setPicUrl('');
                }}
                className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all italic tracking-widest uppercase"
              >
                Enroll
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function Profile({ athlete, onBack, onLog }: { 
  athlete: Athlete, 
  onBack: () => void,
  onLog: () => void 
}) {
  const [trials, setTrials] = useState<Trial[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const trialsPath = `teachers/${auth.currentUser.uid}/athletes/${athlete.id}/trials`;
    const q = query(collection(db, trialsPath), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const trialList: Trial[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Trial));
      setTrials(trialList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, trialsPath);
    });

    return () => unsubscribe();
  }, [athlete.id]);

  const chartData = trials
    .filter(t => t.trialType === '100m Sprint')
    .slice()
    .reverse()
    .map(t => ({ date: t.date, value: t.value }));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-8 pb-20"
    >
      <button onClick={onBack} className="flex items-center gap-2 group">
        <div className="bg-white border border-slate-100 p-2 rounded-lg group-hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-3 h-3 text-slate-400" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900 transition-colors">Performance Dashboard</span>
      </button>

      <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden ring-4 ring-blue-600/5 shadow-xl">
            <img 
              src={athlete.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${athlete.name}`} 
              alt={athlete.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-black tracking-tighter text-slate-900 uppercase italic leading-none">{athlete.name}</h2>
            <div className="flex flex-wrap gap-2">
              <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.1em] border border-green-100">National Potential</span>
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.1em] border border-blue-100">{athlete.sport}</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="text-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">Age</p>
            <p className="text-lg font-black text-slate-900">{athlete.age}</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">Trials</p>
            <p className="text-lg font-black text-slate-900">{trials.length}</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-2xl border border-blue-100">
            <p className="text-[8px] font-black uppercase text-blue-400 tracking-wider mb-1">Tier</p>
            <p className="text-lg font-black text-blue-600 italic">Elite</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            Talent Growth Curve
          </h3>
          <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Cloud Active</span>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 h-64 w-full shadow-lg shadow-slate-200/40 relative overflow-hidden">
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" hide />
                <YAxis domain={['auto', 'auto']} reversed hide />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid #F1F5F9', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    fontSize: '10px',
                    fontWeight: 900,
                    textTransform: 'uppercase'
                  }}
                  labelStyle={{ display: 'none' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#2563eb" 
                  strokeWidth={5} 
                  dot={{ fill: '#2563eb', strokeWidth: 3, r: 6, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0, fill: '#1d4ed8' }}
                  animationDuration={2000}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 text-center px-8">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                <TrendingUp className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">Insufficient History.<br/><span className="text-[10px] opacity-60 font-medium tracking-normal">Log 2 records to sync curve</span></p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2rem] p-7 text-white space-y-4 shadow-2xl relative overflow-hidden group">
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-600/30 rounded-full blur-[40px] group-hover:scale-150 transition-transform duration-1000" />
        <div className="flex items-center gap-2 mb-2">
          <Award className="w-4 h-4 text-blue-400" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Database Analytics</h4>
        </div>
        <p className="text-sm font-bold leading-relaxed text-slate-100 italic">
          Athlete development is consistent. Ranks in the top percentile of student metrics. Last update: {new Date().toLocaleDateString()}.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Full Trial History</h3>
          <button 
            onClick={onLog}
            className="text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-2 bg-blue-600 px-5 py-2.5 rounded-full shadow-lg shadow-blue-500/30 active:scale-95 transition-all italic"
          >
            <Timer className="w-4 h-4" />
            Capture Trial
          </button>
        </div>

        <div className="grid gap-2">
          {trials.length > 0 ? (
            trials.map((trial, tidx) => (
              <motion.div 
                key={trial.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: tidx * 0.1 }}
                className="bg-white p-5 rounded-2xl border border-slate-50 flex justify-between items-center group hover:border-slate-100 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-slate-200 rounded-full group-hover:bg-blue-600 transition-colors" />
                  <div>
                    <p className="text-[11px] font-black uppercase text-slate-700 tracking-tighter">{trial.trialType}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-widest">{trial.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors tabular-nums italic">
                    {trial.value.toFixed(2)}
                    <span className="text-[10px] text-slate-400 lowercase italic ml-1 font-normal tracking-normal">{trial.unit}</span>
                  </p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-300">
               <p className="text-[10px] font-black uppercase tracking-widest">No Cloud Records Found</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Leaderboard({ athletes, onBack, onSelect }: { 
  athletes: Athlete[], 
  onBack: () => void, 
  onSelect: (id: string) => void 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8 pb-12"
    >
      <button onClick={onBack} className="flex items-center gap-2 group">
        <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900 transition-colors">Exit Ranks</span>
      </button>

      <header className="text-center py-6 space-y-2">
        <div className="inline-block bg-amber-50 text-amber-600 p-3 rounded-full border border-amber-100 mb-2">
          <Trophy className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-black tracking-tighter italic uppercase">Cloud Rankings</h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] max-w-xs mx-auto">Live cross-athlete performance aggregation.</p>
      </header>

      <div className="space-y-3">
        {athletes.slice(0, 3).map((athlete, idx) => (
          <motion.div 
            key={athlete.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => onSelect(athlete.id)}
            className={`
              relative p-6 rounded-[2rem] border transition-all cursor-pointer flex items-center justify-between
              ${idx === 0 ? 'bg-amber-50 border-amber-200' : 
                idx === 1 ? 'bg-slate-100 border-slate-200' : 
                'bg-orange-50 border-orange-200'}
            `}
          >
            <div className="flex items-center gap-5">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-black italic text-lg
                ${idx === 0 ? 'bg-amber-400 text-amber-900' : 
                  idx === 1 ? 'bg-slate-300 text-slate-700' : 
                  'bg-orange-400 text-orange-900'}
              `}>
                {idx + 1}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 uppercase italic tracking-tighter leading-none">{athlete.name}</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">{athlete.sport}</p>
              </div>
            </div>
            <div className="text-[10px] font-black uppercase text-emerald-500 italic">Qualified</div>
          </motion.div>
        ))}

        {athletes.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <Search className="w-12 h-12 text-slate-200 mx-auto" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Database Search Returned Empty</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TrialLogger({ athlete, onBack, onSave }: {
  athlete: Athlete,
  onBack: () => void,
  onSave: (val: number) => void
}) {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(() => {
        setTime(prev => prev + 10);
      }, 10);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="flex flex-col items-center justify-center space-y-12 py-12"
    >
      <div className="text-center space-y-3">
        <div className="inline-block bg-blue-50 text-blue-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-blue-100">
          Capture Trial Session
        </div>
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase">{athlete.name}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">100 Meter Sprint // Hand-Timed</p>
        </div>
      </div>

      <div className="relative group">
        <div className={`absolute inset-0 transition-all duration-500 rounded-full blur-[60px] ${isRunning ? 'bg-red-500/20' : 'bg-blue-600/10'}`} />
        
        <div className={`relative bg-white w-72 h-72 rounded-[4rem] border-[16px] shadow-2xl flex flex-col items-center justify-center transition-all ${isRunning ? 'border-red-50' : 'border-slate-50'}`}>
          <div className="absolute top-8 text-[11px] font-black uppercase text-slate-300 tracking-[0.3em]">Precision-Timer</div>
          <span className={`text-7xl font-black italic tabular-nums font-mono tracking-tighter ${isRunning ? 'text-red-600' : 'text-slate-900'}`}>
            {formatTime(time)}
          </span>
          <div className="flex gap-1 mt-4">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-red-500 animate-pulse' : 'bg-slate-200'}`} />
            <div className="w-2 h-2 rounded-full bg-slate-200" />
            <div className="w-2 h-2 rounded-full bg-slate-200" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full px-4">
        {!isRunning && time === 0 ? (
          <button 
            onClick={() => setIsRunning(true)}
            className="w-full bg-slate-900 text-white h-20 rounded-[2rem] font-black text-2xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase italic"
          >
            <Plus className="w-8 h-8 text-blue-400" />
            Start Timer
          </button>
        ) : isRunning ? (
          <button 
            onClick={() => setIsRunning(false)}
            className="w-full bg-red-600 text-white h-20 rounded-[2rem] font-black text-2xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase italic"
          >
            <div className="w-6 h-6 bg-white/20 rounded h-1/2" />
            Stop
          </button>
        ) : (
          <div className="flex gap-4">
            <button 
              onClick={() => { setTime(0); setIsRunning(false); }}
              className="flex-1 bg-slate-100 text-slate-500 h-20 rounded-[2rem] font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
            >
              Reset
            </button>
            <button 
              onClick={() => onSave(parseFloat((time / 1000).toFixed(2)))}
              className="flex-[2] bg-gradient-to-br from-blue-600 to-blue-800 text-white h-20 rounded-[2rem] font-black text-lg shadow-xl shadow-blue-500/30 active:scale-95 transition-all uppercase italic"
            >
              Commit Data
            </button>
          </div>
        )}

        <button onClick={onBack} className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] py-4 hover:text-slate-900 transition-colors">
          Abort Session
        </button>
      </div>
    </motion.div>
  );
}
