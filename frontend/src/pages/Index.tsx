import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "";

interface PredictionResult {
  churn_probability: number;
  prediction: string;
  risk_level: string;
  confidence: number;
  key_factors: string[];
}

interface RiskDriver {
  label: string;
  detail: string;
  impact: number;      // 0–100 (visual bar width)
  type: "danger" | "warning" | "positive";
  icon: string;
  category: "behaviour" | "financial" | "demographic" | "engagement";
}

const riskColor = (prob: number) => {
  if (prob < 0.3) return "hsl(152, 60%, 42%)";
  if (prob <= 0.65) return "hsl(38, 92%, 50%)";
  return "hsl(0, 72%, 51%)";
};

const riskLabel = (prob: number) => {
  if (prob < 0.3) return "Low";
  if (prob <= 0.65) return "Medium";
  return "High";
};

// ── Derive structured risk drivers from inputs ────────
function buildRiskDrivers(
  creditScore: number,
  age: number,
  geography: string,
  tenure: number,
  products: number,
  balance: number,
  isActive: number,
  prob: number
): RiskDriver[] {
  const drivers: RiskDriver[] = [];

  // ── DANGER signals ──
  if (isActive === 0) {
    drivers.push({
      label: "Inactive Account",
      detail: "Customer hasn't engaged with any banking activity recently. Disengaged customers are 3× more likely to churn.",
      impact: 92,
      type: "danger",
      icon: "💤",
      category: "behaviour",
    });
  }
  if (products >= 3) {
    drivers.push({
      label: `${products} Products Linked`,
      detail: "Customers with 3+ products often feel overwhelmed or oversold. Paradoxically, this correlates strongly with churn.",
      impact: 85,
      type: "danger",
      icon: "📦",
      category: "engagement",
    });
  }
  if (geography === "Germany") {
    drivers.push({
      label: "Germany Geography",
      detail: "Customers in Germany show a significantly higher churn rate in our dataset — nearly 2× the baseline.",
      impact: 72,
      type: "danger",
      icon: "🌍",
      category: "demographic",
    });
  }
  if (age > 55) {
    drivers.push({
      label: `Age ${age} — Senior segment`,
      detail: "Customers above 55 switch banks more frequently, often seeking retirement-focused products competitors offer.",
      impact: 65,
      type: "danger",
      icon: "👤",
      category: "demographic",
    });
  } else if (age > 45) {
    drivers.push({
      label: `Age ${age} — Elevated risk bracket`,
      detail: "The 45–55 age group shows above-average churn — often reassessing financial relationships mid-career.",
      impact: 48,
      type: "warning",
      icon: "👤",
      category: "demographic",
    });
  }
  if (creditScore < 450) {
    drivers.push({
      label: `Credit Score ${creditScore} — Very Low`,
      detail: "A very low credit score suggests financial stress. Customers under pressure often consolidate to fewer banks.",
      impact: 78,
      type: "danger",
      icon: "📉",
      category: "financial",
    });
  } else if (creditScore < 580) {
    drivers.push({
      label: `Credit Score ${creditScore} — Below Average`,
      detail: "Below-average credit score is a moderate churn signal — financial instability can lead to account closure.",
      impact: 50,
      type: "warning",
      icon: "📉",
      category: "financial",
    });
  }
  if (balance > 150000) {
    drivers.push({
      label: `High Balance €${balance.toLocaleString()}`,
      detail: "Very high-balance customers are often targeted by premium wealth management competitors, increasing poaching risk.",
      impact: 68,
      type: "warning",
      icon: "💰",
      category: "financial",
    });
  } else if (balance > 100000) {
    drivers.push({
      label: `Elevated Balance €${balance.toLocaleString()}`,
      detail: "Customers with large balances attract competitor offers. Without personalised service, they tend to leave.",
      impact: 52,
      type: "warning",
      icon: "💰",
      category: "financial",
    });
  }
  if (tenure <= 1) {
    drivers.push({
      label: tenure === 0 ? "Brand New Customer" : "Only 1 Year Tenure",
      detail: "New customers have not yet built loyalty. The first 1–2 years are the highest churn-risk window.",
      impact: 60,
      type: "warning",
      icon: "🆕",
      category: "behaviour",
    });
  }

  // ── POSITIVE / protective signals ──
  if (isActive === 1 && tenure >= 5) {
    drivers.push({
      label: "Long-term Active Member",
      detail: `${tenure} years of active engagement is a strong loyalty signal. Long-tenure active customers churn at <10%.`,
      impact: 88,
      type: "positive",
      icon: "🏆",
      category: "behaviour",
    });
  } else if (isActive === 1) {
    drivers.push({
      label: "Active Account",
      detail: "Regular account activity is one of the strongest predictors of retention. This customer is engaged.",
      impact: 70,
      type: "positive",
      icon: "✅",
      category: "behaviour",
    });
  }
  if (tenure >= 7) {
    drivers.push({
      label: `${tenure}-Year Customer`,
      detail: "Long tenure means deeply embedded banking habits. Switching costs are high — this customer is likely sticky.",
      impact: 80,
      type: "positive",
      icon: "📅",
      category: "behaviour",
    });
  } else if (tenure >= 4 && tenure < 7) {
    drivers.push({
      label: `${tenure} Years of Tenure`,
      detail: "Solid tenure. This customer has stayed through multiple product cycles — a positive retention signal.",
      impact: 55,
      type: "positive",
      icon: "📅",
      category: "behaviour",
    });
  }
  if (creditScore >= 750) {
    drivers.push({
      label: `Credit Score ${creditScore} — Excellent`,
      detail: "High credit score indicates financial stability. Stable customers are less likely to churn impulsively.",
      impact: 72,
      type: "positive",
      icon: "⭐",
      category: "financial",
    });
  } else if (creditScore >= 650) {
    drivers.push({
      label: `Credit Score ${creditScore} — Good`,
      detail: "Good credit score suggests financial health — a mild protective factor against churn.",
      impact: 45,
      type: "positive",
      icon: "⭐",
      category: "financial",
    });
  }
  if (products === 2) {
    drivers.push({
      label: "2 Products — Optimal Mix",
      detail: "Two products is the sweet spot. It creates cross-sell stickiness without overwhelming the customer.",
      impact: 65,
      type: "positive",
      icon: "🎯",
      category: "engagement",
    });
  }
  if (geography === "Spain") {
    drivers.push({
      label: "Spain — Low Churn Region",
      detail: "Spanish customers in our dataset show consistently lower churn rates compared to Germany or France.",
      impact: 50,
      type: "positive",
      icon: "🌍",
      category: "demographic",
    });
  }
  if (balance === 0) {
    drivers.push({
      label: "Zero Balance Account",
      detail: "Zero balance may indicate this is a secondary account. Low financial commitment can precede closure.",
      impact: 42,
      type: "warning",
      icon: "⚠️",
      category: "financial",
    });
  }

  // Sort: danger first, then warning, then positive
  const order = { danger: 0, warning: 1, positive: 2 };
  drivers.sort((a, b) => order[a.type] - order[b.type]);

  return drivers;
}

const categoryLabel: Record<string, string> = {
  behaviour:   "Behaviour",
  financial:   "Financial",
  demographic: "Demographic",
  engagement:  "Engagement",
};

// ── Components ────────────────────────────────────────

function PillToggle({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string | number }[];
  value: string | number;
  onChange: (v: string | number) => void;
}) {
  return (
    <div className="flex rounded-lg bg-secondary p-1 gap-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            value === o.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RangeSlider({
  label, min, max, step, value, onChange,
}: {
  label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className="font-mono-display text-sm font-bold text-primary">{value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step || 1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function SemiCircleGauge({ value }: { value: number }) {
  const size = 200, radius = 75, strokeWidth = 12;
  const cx = size / 2, cy = size / 2 + 10;
  const circumference = Math.PI * radius;
  const fillLength = circumference * value;
  const color = riskColor(value);
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
        <path d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none" stroke="hsl(220, 13%, 90%)" strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={`${fillLength} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.9s cubic-bezier(.4,0,.2,1), stroke 0.5s ease" }} />
      </svg>
      <span className="font-mono-display text-4xl font-bold -mt-10" style={{ color }}>
        {(value * 100).toFixed(1)}%
      </span>
    </div>
  );
}

function RiskBar({ probability }: { probability: number }) {
  return (
    <div className="space-y-2">
      <div className="relative h-2.5 rounded-full overflow-visible"
        style={{ background: "linear-gradient(90deg, hsl(152,60%,42%), hsl(38,92%,50%), hsl(0,72%,51%))" }}>
        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-card border-2 border-foreground shadow-md"
          style={{ left: `calc(${probability * 100}% - 8px)`, transition: "left 0.8s cubic-bezier(.4,0,.2,1)" }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Low</span><span>Medium</span><span>High</span>
      </div>
    </div>
  );
}

// ── NEW: Risk Driver Card ─────────────────────────────
function DriverCard({ driver, index }: { driver: RiskDriver; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const colors = {
    danger:   { bg: "hsl(0,72%,51%,0.08)",   border: "hsl(0,72%,51%,0.25)",   bar: "hsl(0,72%,51%)",   badge: "hsl(0,72%,51%,0.12)",   text: "hsl(0,72%,40%)" },
    warning:  { bg: "hsl(38,92%,50%,0.08)",  border: "hsl(38,92%,50%,0.25)",  bar: "hsl(38,92%,50%)",  badge: "hsl(38,92%,50%,0.12)",  text: "hsl(38,72%,35%)" },
    positive: { bg: "hsl(152,60%,42%,0.08)", border: "hsl(152,60%,42%,0.25)", bar: "hsl(152,60%,42%)", badge: "hsl(152,60%,42%,0.12)", text: "hsl(152,60%,30%)" },
  };
  const c = colors[driver.type];

  return (
    <div
      className="rounded-xl border p-3.5 cursor-pointer transition-all duration-200 hover:shadow-md"
      style={{
        background: c.bg, borderColor: c.border,
        animationDelay: `${index * 60}ms`,
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <span className="text-xl shrink-0">{driver.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-sm font-semibold text-foreground truncate">{driver.label}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: c.badge, color: c.text }}>
                {categoryLabel[driver.category]}
              </span>
              <span className="text-muted-foreground text-xs">{expanded ? "▲" : "▼"}</span>
            </div>
          </div>
          {/* Impact bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${driver.impact}%`, background: c.bar }}
              />
            </div>
            <span className="text-xs font-mono-display font-bold shrink-0" style={{ color: c.text, minWidth: "36px" }}>
              {driver.impact}%
            </span>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <p className="mt-3 text-sm leading-relaxed pl-9" style={{ color: c.text }}>
          {driver.detail}
        </p>
      )}
    </div>
  );
}

// ── NEW: Risk Breakdown Panel ─────────────────────────
function RiskBreakdown({ drivers, prob }: { drivers: RiskDriver[]; prob: number }) {
  const danger   = drivers.filter(d => d.type === "danger");
  const warnings = drivers.filter(d => d.type === "warning");
  const positive = drivers.filter(d => d.type === "positive");

  const summaryText = () => {
    if (prob >= 0.65) {
      return `This customer is at HIGH risk. ${danger.length > 0 ? `The primary concern${danger.length > 1 ? "s are" : " is"} ${danger.slice(0,2).map(d=>d.label.toLowerCase()).join(" and ")}.` : ""} Immediate retention action is recommended.`;
    }
    if (prob >= 0.3) {
      return `This customer shows MEDIUM risk. There are ${warnings.length + danger.length} concerning signal${warnings.length + danger.length !== 1 ? "s" : ""} but also ${positive.length} protective factor${positive.length !== 1 ? "s" : ""}. Monitor closely.`;
    }
    return `This customer is at LOW risk. ${positive.length} strong retention signal${positive.length !== 1 ? "s are" : " is"} present. Continue regular engagement to maintain loyalty.`;
  };

  return (
    <div className="space-y-4 mt-5">
      {/* Summary banner */}
      <div className="rounded-xl p-4 border"
        style={{
          background: prob >= 0.65 ? "hsl(0,72%,51%,0.07)" : prob >= 0.3 ? "hsl(38,92%,50%,0.07)" : "hsl(152,60%,42%,0.07)",
          borderColor: prob >= 0.65 ? "hsl(0,72%,51%,0.2)" : prob >= 0.3 ? "hsl(38,92%,50%,0.2)" : "hsl(152,60%,42%,0.2)",
        }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1"
          style={{ color: riskColor(prob) }}>Why is the risk {riskLabel(prob)}?</p>
        <p className="text-sm text-foreground/80 leading-relaxed">{summaryText()}</p>
      </div>

      {/* Score tally */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Risk Factors",      count: danger.length,   color: "hsl(0,72%,51%)",   bg: "hsl(0,72%,51%,0.08)" },
          { label: "Caution Signals",   count: warnings.length, color: "hsl(38,92%,50%)",  bg: "hsl(38,92%,50%,0.08)" },
          { label: "Protective Factors",count: positive.length, color: "hsl(152,60%,42%)", bg: "hsl(152,60%,42%,0.08)" },
        ].map(s => (
          <div key={s.label} className="rounded-lg p-2.5" style={{ background: s.bg }}>
            <div className="text-2xl font-bold font-mono-display" style={{ color: s.color }}>{s.count}</div>
            <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Driver cards — danger + warning first */}
      {(danger.length > 0 || warnings.length > 0) && (
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
            ⚠️ What's driving the risk up
          </p>
          <div className="space-y-2">
            {[...danger, ...warnings].map((d, i) => (
              <DriverCard key={d.label} driver={d} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Protective factors */}
      {positive.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
            ✅ What's keeping the customer
          </p>
          <div className="space-y-2">
            {positive.map((d, i) => (
              <DriverCard key={d.label} driver={d} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Retention tip */}
      <div className="rounded-xl border border-border bg-secondary p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">💡 Recommended Action</p>
        <p className="text-sm text-foreground/80 leading-relaxed">
          {prob >= 0.65
            ? "Schedule an immediate outreach call. Consider a personalised retention offer — fee waiver, loyalty reward, or premium upgrade. Re-engagement within 7 days significantly reduces churn probability."
            : prob >= 0.3
            ? "Enrol this customer in a proactive nurture sequence. A personalised check-in email or product recommendation in the next 30 days can tip them toward staying."
            : "Keep up regular engagement. Customers at low risk still benefit from occasional personalised touchpoints — product updates, rewards milestones, or a simple satisfaction survey."}
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────
const ChurnScope = () => {
  const { toast } = useToast();

  const [creditScore, setCreditScore] = useState(619);
  const [age, setAge]                 = useState(42);
  const [geography, setGeography]     = useState("France");
  const [gender, setGender]           = useState("Female");
  const [tenure, setTenure]           = useState(2);
  const [products, setProducts]       = useState(1);
  const [balance, setBalance]         = useState(0);
  const [salary, setSalary]           = useState(101349);
  const [hasCreditCard, setHasCreditCard] = useState(1);
  const [isActive, setIsActive]       = useState(1);

  const [result, setResult]       = useState<PredictionResult | null>(null);
  const [drivers, setDrivers]     = useState<RiskDriver[]>([]);
  const [loading, setLoading]     = useState(false);
  const [showResult, setShowResult] = useState(false);

  const predict = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credit_score: creditScore, geography, gender, age, tenure,
          balance, num_of_products: products,
          has_cr_card: hasCreditCard, is_active_member: isActive,
          estimated_salary: salary,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data: PredictionResult = await res.json();
      setResult(data);
      setDrivers(buildRiskDrivers(creditScore, age, geography, tenure, products, balance, isActive, data.churn_probability));
      setShowResult(true);
    } catch {
      toast({ title: "Connection Issue", description: "Could not reach the API. Showing demo prediction.", variant: "destructive" });
      const demoProb = Math.random() * 0.8 + 0.05;
      const demoResult = {
        churn_probability: demoProb,
        prediction: demoProb > 0.5 ? "Churn" : "Stay",
        risk_level: riskLabel(demoProb),
        confidence: 1 - demoProb,
        key_factors: ["Active member with long tenure — loyal customer", "Low account balance may indicate disengagement"],
      };
      setResult(demoResult);
      setDrivers(buildRiskDrivers(creditScore, age, geography, tenure, products, balance, isActive, demoProb));
      setShowResult(true);
    } finally {
      setLoading(false);
    }
  }, [creditScore, age, geography, gender, tenure, products, balance, salary, hasCreditCard, isActive, toast]);

  const prob = result?.churn_probability ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">⚡</div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              Churn<span className="text-primary">Scope</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span className="text-xs font-medium text-success">Online</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="text-center pt-10 pb-6 px-4 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <h1 className="text-2xl sm:text-4xl font-bold text-foreground leading-tight">
          Customer Churn Prediction
        </h1>
        <p className="mt-2 text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
          Enter customer details and instantly predict churn risk with detailed reasoning.
        </p>
      </section>

      {/* Main Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Form ── */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="text-base font-semibold text-foreground mb-5">Customer Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <RangeSlider label="Credit Score"   min={300} max={900} value={creditScore} onChange={setCreditScore} />
            <RangeSlider label="Age"            min={18}  max={92}  value={age}         onChange={setAge} />

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Geography</label>
              <select value={geography} onChange={(e) => setGeography(e.target.value)}
                className="w-full bg-secondary text-foreground rounded-lg px-3 py-2.5 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="France">🇫🇷 France</option>
                <option value="Germany">🇩🇪 Germany</option>
                <option value="Spain">🇪🇸 Spain</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Gender</label>
              <PillToggle options={[{ label: "Male", value: "Male" }, { label: "Female", value: "Female" }]}
                value={gender} onChange={(v) => setGender(String(v))} />
            </div>

            <RangeSlider label="Tenure (years)"  min={0} max={10} value={tenure}   onChange={setTenure} />
            <RangeSlider label="Products Count"  min={1} max={4}  value={products} onChange={setProducts} />

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Account Balance (€)</label>
              <input type="number" value={balance} onChange={(e) => setBalance(Number(e.target.value))}
                className="w-full bg-secondary text-foreground rounded-lg px-3 py-2.5 text-sm font-mono-display border border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="0.00" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Estimated Salary (€/yr)</label>
              <input type="number" value={salary} onChange={(e) => setSalary(Number(e.target.value))}
                className="w-full bg-secondary text-foreground rounded-lg px-3 py-2.5 text-sm font-mono-display border border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="0.00" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Has Credit Card</label>
              <PillToggle options={[{ label: "Yes", value: 1 }, { label: "No", value: 0 }]}
                value={hasCreditCard} onChange={(v) => setHasCreditCard(Number(v))} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Active Member</label>
              <PillToggle options={[{ label: "Active", value: 1 }, { label: "Inactive", value: 0 }]}
                value={isActive} onChange={(v) => setIsActive(Number(v))} />
            </div>
          </div>

          <button onClick={predict} disabled={loading}
            className="mt-7 w-full bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-lg transition-all duration-200 hover:opacity-90 hover:shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
            {loading
              ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin-custom" />
              : <>⚡ Predict Churn Risk</>}
          </button>
        </div>

        {/* ── Result ── */}
        <div className="flex flex-col gap-6">
          {showResult && result ? (
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm animate-fade-in-up overflow-y-auto" style={{ maxHeight: "90vh" }}>
              <h2 className="text-base font-semibold text-foreground mb-4">Prediction Result</h2>

              <SemiCircleGauge value={prob} />

              {/* Verdict pill */}
              <div className="mt-4 flex justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
                  style={{
                    background: prob < 0.5 ? "hsl(152,60%,42%,0.1)" : "hsl(0,72%,51%,0.1)",
                    color: prob < 0.5 ? "hsl(152,60%,42%)" : "hsl(0,72%,51%)",
                  }}>
                  {prob < 0.5 ? "✅" : "⚠️"}{" "}
                  {prob < 0.5 ? "Low Churn Risk" : "High Churn Risk"} — {(prob * 100).toFixed(1)}%
                </div>
              </div>

              {/* Risk bar */}
              <div className="mt-6"><RiskBar probability={prob} /></div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="bg-secondary rounded-lg p-3.5 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Confidence</p>
                  <p className="font-mono-display text-lg font-bold" style={{ color: riskColor(1 - (result.confidence ?? 0)) }}>
                    {((result.confidence ?? 0) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-secondary rounded-lg p-3.5 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Risk Level</p>
                  <p className="font-mono-display text-lg font-bold" style={{ color: riskColor(prob) }}>
                    {result.risk_level}
                  </p>
                </div>
              </div>

              {/* ── Risk Breakdown ── */}
              <RiskBreakdown drivers={drivers} prob={prob} />
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-12 shadow-sm flex flex-col items-center justify-center text-center animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-2xl mb-4">📊</div>
              <p className="text-sm font-medium text-muted-foreground">
                Fill in the customer details and click predict to see a full risk breakdown.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ChurnScope;
