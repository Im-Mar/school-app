"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function History() {
  const [rows, setRows] = useState<any[]>([]);

  async function fetchHistory() {
    const { data } = await supabase
      .from("history_records")
      .select("*")
      .order("School_Date", { ascending: true }) // oldest → newest
      .order("Student_Name", { ascending: true });

    if (!data) return;

    // 🔥 Running total (oldest → newest per student)
    const runningMap: Record<string, number> = {};

    const processed = data.map((r) => {
      const prev = runningMap[r.Student_Name] || 0;
      const next = Math.max(0, prev + (r.Daily_Total || 0));
      runningMap[r.Student_Name] = next;

      let level = "Level 1";
      if (next >= 600) level = "Level 4";
      else if (next >= 300) level = "Level 3";
      else if (next >= 100) level = "Level 2";

      return {
        ...r,
        Running_Total: next,
        Level: level,
      };
    });

    setRows(processed.reverse()); // newest on top visually
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  async function updateField(id: string, field: string, value: any) {
    await supabase.from("history_records").update({ [field]: value }).eq("id", id);

    // 🔥 Recalculate Daily Total live
    const { data } = await supabase.from("history_records").select("*").eq("id", id).single();
    if (!data) return;

    const newTotal = calculateDailyTotal(data);

    await supabase
      .from("history_records")
      .update({ Daily_Total: newTotal })
      .eq("id", id);

    fetchHistory();
  }

  function calculateDailyTotal(s: any) {
    let total =
      (s.Title_AM || 0) +
      (s.Period_A || 0) +
      (s.Period_B || 0) +
      (s.Period_C || 0) +
      (s.Period_D || 0) +
      (s.Lunch_Period || 0) +
      (s.Period_E || 0) +
      (s.Period_F || 0) +
      (s.Title_PM || 0);

    if (s.Circle_AM) total += 3;
    if (s.Circle_PM) total += 8;
    if (s.WotD) total += 5;

    if (s.Suspension === "Suspended" || s.Suspension === "Unexcused") total -= 28;

    ["WriteUp_1", "WriteUp_2", "WriteUp_3"].forEach((w) => {
      if (s[w]) total -= 5;
    });

    total += s.Online_Progress_Value || 0;
    total += s.Bonus_Points || 0;

    if (s.Level_Drop_Checked) total -= s.Level_Drop_Value || 0;

    return total;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>History</h1>

      <a href="/" style={{ marginBottom: 20, display: "inline-block" }}>
        ← Back to Point Sheet
      </a>

      <table border={1} cellPadding={6}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Date</th>
            <th>A</th>
            <th>B</th>
            <th>C</th>
            <th>Total</th>
            <th>Running</th>
            <th>Level</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td>{s.Student_Name}</td>
              <td>{s.School_Date}</td>

              {["Period_A", "Period_B", "Period_C"].map((p) => (
                <td key={p}>
                  <select
                    value={s[p] ?? 0}
                    onChange={(e) => updateField(s.id, p, Number(e.target.value))}
                  >
                    {[-3, -2, -1, 0, 1, 2, 3].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </td>
              ))}

              <td>{s.Daily_Total}</td>
              <td>{s.Running_Total}</td>
              <td>{s.Level}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}