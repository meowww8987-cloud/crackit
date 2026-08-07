'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, ReferenceLine, ScatterChart, Scatter, ZAxis, CartesianGrid } from 'recharts';
import type { Test, Subject, SubjectAnalytics } from '@/lib/types';
import { subjectColor, SUBJECTS } from '@/lib/colors';

// ===== 1. Time Management =====
export function TimeManagementChart({ analytics }: { analytics: Record<Subject, SubjectAnalytics> }) {
  const data = SUBJECTS.filter((s) => analytics[s]).map((s) => ({
    subject: s.slice(0, 4),
    time: analytics[s].timeSpent,
    color: subjectColor(s).hex,
  }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
          <XAxis dataKey="subject" tick={{ fill: '#ffffff60', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#ffffff60', fontSize: 10 }} axisLine={false} tickLine={false} />
          <ReferenceLine y={45} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '45m', fill: '#f59e0b', fontSize: 9 }} />
          <Bar dataKey="time" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.time > 45 ? '#ef4444' : d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ===== 2. Negative Marking Pattern =====
export function NegativeMarkingChart({ analytics }: { analytics: Record<Subject, SubjectAnalytics> }) {
  const data = SUBJECTS.filter((s) => analytics[s]).map((s) => ({
    subject: s.slice(0, 4),
    correct: analytics[s].correct,
    wrong: analytics[s].wrong,
  }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="subject" tick={{ fill: '#ffffff60', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#ffffff60', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Bar dataKey="correct" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} name="Correct" />
          <Bar dataKey="wrong" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Wrong" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ===== 3. Confidence vs Accuracy Scatter =====
export function ConfidenceAccuracyChart({ analytics }: { analytics: Record<Subject, SubjectAnalytics> }) {
  const data = SUBJECTS.filter((s) => analytics[s]).map((s) => {
    const a = analytics[s];
    const accuracy = a.attempted > 0 ? (a.correct / a.attempted) * 100 : 0;
    const confidence = (a.confidence / 5) * 100;
    return {
      subject: s,
      x: confidence,
      y: accuracy,
      color: subjectColor(s).hex,
    };
  });

  return (
    <div className="h-56 relative">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 15, left: -10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis
            type="number"
            dataKey="x"
            name="Confidence"
            domain={[0, 100]}
            tick={{ fill: '#ffffff60', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Confidence →', position: 'insideBottom', offset: -10, fill: '#ffffff60', fontSize: 10 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Accuracy"
            domain={[0, 100]}
            tick={{ fill: '#ffffff60', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Accuracy →', angle: -90, position: 'insideLeft', fill: '#ffffff60', fontSize: 10 }}
          />
          <ZAxis range={[120, 120]} />
          <Scatter data={data}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      {/* Quadrant labels */}
      <div className="absolute top-2 right-16 text-[8px] text-green-400/60">Great</div>
      <div className="absolute top-2 left-12 text-[8px] text-amber-400/60">Underconfident</div>
      <div className="absolute bottom-8 right-16 text-[8px] text-red-400/60">Overconfident</div>
      <div className="absolute bottom-8 left-12 text-[8px] text-red-400/60">Weak</div>
      {/* Subject dots legend */}
      <div className="flex flex-wrap gap-2 mt-1">
        {data.map((d) => (
          <span key={d.subject} className="text-[9px] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
            {d.subject}
          </span>
        ))}
      </div>
    </div>
  );
}

// ===== 4. Smart Insights (auto-generated) =====
export function SmartInsights({ analytics }: { analytics: Record<Subject, SubjectAnalytics> }) {
  const insights: { severity: 'high' | 'medium' | 'low'; text: string }[] = [];

  for (const s of SUBJECTS.filter((s) => analytics[s])) {
    const a = analytics[s];
    const subj = s;

    // Time per question
    if (a.attempted > 0) {
      const secPerQ = (a.timeSpent * 60) / a.attempted;
      if (secPerQ > 60) {
        insights.push({
          severity: 'high',
          text: `⚠ ${subj}: spending ${Math.round(secPerQ)}s/question — ${Math.round(secPerQ / 30)}x recommended. Practice speed runs.`,
        });
      }
    }

    // Wrong attempts ratio
    if (a.attempted > 0) {
      const wrongPct = (a.wrong / a.attempted) * 100;
      if (wrongPct > 20) {
        const marksLost = a.wrong;
        insights.push({
          severity: 'medium',
          text: `◆ ${subj}: ${Math.round(wrongPct)}% wrong attempts — losing ~${marksLost} marks. Skip unsure questions.`,
        });
      }
    }

    // Confidence vs accuracy (underconfident)
    if (a.attempted > 0) {
      const accuracy = (a.correct / a.attempted) * 100;
      const confidencePct = (a.confidence / 5) * 100;
      if (accuracy > confidencePct + 15) {
        insights.push({
          severity: 'low',
          text: `✓ ${subj}: UNDERCONFIDENT — scored ${Math.round(accuracy)}% but felt ${Math.round(confidencePct)}%. Trust your prep.`,
        });
      } else if (accuracy < confidencePct - 15) {
        insights.push({
          severity: 'high',
          text: `⚠ ${subj}: OVERCONFIDENT — felt ${Math.round(confidencePct)}% but scored ${Math.round(accuracy)}%. Review fundamentals.`,
        });
      }
    }

    // Silly mistakes
    if (a.sillyMistakes >= 3) {
      insights.push({
        severity: 'medium',
        text: `◆ ${subj}: ${a.sillyMistakes} silly mistakes. Slow down and read carefully.`,
      });
    }
  }

  if (insights.length === 0) {
    return (
      <div className="glass rounded-xl p-3 text-center text-xs text-white/40">
        No insights — add more analytics data to see findings.
      </div>
    );
  }

  const severityColor = {
    high: 'border-red-500/30 bg-red-500/10 text-red-300',
    medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    low: 'border-green-500/30 bg-green-500/10 text-green-300',
  };

  return (
    <div className="space-y-2">
      {insights.map((ins, i) => (
        <div key={i} className={`glass rounded-xl p-3 border ${severityColor[ins.severity]}`}>
          <span className="text-xs">{ins.text}</span>
        </div>
      ))}
    </div>
  );
}

// ===== 5. Silly Mistakes tally =====
export function SillyMistakesTally({ analytics }: { analytics: Record<Subject, SubjectAnalytics> }) {
  const data = SUBJECTS.filter((s) => analytics[s]);
  if (data.length === 0) return null;
  const total = data.reduce((acc, s) => acc + analytics[s].sillyMistakes, 0);

  return (
    <div>
      <div className="text-xs text-white/50 mb-2">Total silly mistakes: <span className="text-red-400 font-bold tabular">{total}</span></div>
      <div className="grid grid-cols-2 gap-2">
        {data.map((s) => {
          const count = analytics[s].sillyMistakes;
          const color = subjectColor(s).hex;
          return (
            <div key={s} className="glass rounded-xl p-2.5 flex items-center gap-2">
              <div className="w-2 h-8 rounded" style={{ background: color }} />
              <div>
                <div className="text-[10px] text-white/50">{s}</div>
                <div className="text-lg font-bold tabular text-red-400">{count}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
