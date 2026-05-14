"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function History() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    const { data, error } = await supabase
      .from("history_records")
      .select("*");

    console.log("HISTORY:", data, error);

    if (error || !data) return;

    // GROUP ORDER
    const groupOrder: Record<string, number> = {
      MS: 0,
      "9th": 1,
      "10th": 2,
      "11th": 3,
      "12th": 4,
    };

    // SORT:
    // newest date -> group -> alphabetical
    const sorted = [...data].sort((a, b) => {
      // DATE FIRST
      const dateCompare =
        new Date(b.School_Date).getTime() -
        new Date(a.School_Date).getTime();

      if (dateCompare !== 0) {
        return dateCompare;
      }

      // THEN GROUP
      const groupCompare =
        (groupOrder[a.Class_Group] ?? 999) -
        (groupOrder[b.Class_Group] ?? 999);

      if (groupCompare !== 0) {
        return groupCompare;
      }

      // THEN NAME
      return (a.Student_Name || "").localeCompare(
        b.Student_Name || ""
      );
    });

    // BUILD TRUE RUNNING TOTALS
    // must be calculated oldest -> newest
    const chronological = [...sorted].sort((a, b) => {
      return (
        new Date(a.School_Date).getTime() -
        new Date(b.School_Date).getTime()
      );
    });

    const runningTotals: Record<string, number> = {};

    chronological.forEach((r) => {
      const previous =
        runningTotals[r.Student_Name] || 0;

      const daily = r.Daily_Total || 0;

      let next = previous + daily;

      // prevent below 0
      if (next < 0) {
        next = 0;
      }

      runningTotals[r.Student_Name] = next;
    });

    // APPLY RUNNING TOTALS
    const processed = sorted.map((r) => {
      const running =
        runningTotals[r.Student_Name] || 0;

      let level = "Level 1";

      if (running >= 600) {
        level = "Level 4";
      } else if (running >= 300) {
        level = "Level 3";
      } else if (running >= 100) {
        level = "Level 2";
      }

      return {
        ...r,
        Running_Total: running,
        Level: level,
      };
    });

    // ADD SPACERS BETWEEN DAYS
    const grouped: any[] = [];

    let currentDate = "";

    processed.forEach((student) => {
      if (student.School_Date !== currentDate) {
        currentDate = student.School_Date;

        if (grouped.length > 0) {
          grouped.push({
            id: `spacer-${currentDate}`,
            isSpacer: true,
          });
        }
      }

      grouped.push(student);
    });

    setRows(grouped);
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

    if (
      ["Suspended", "Unexcused"].includes(
        s.Suspension
      )
    ) {
      total -= 28;
    }

    ["WriteUp_1", "WriteUp_2", "WriteUp_3"].forEach(
      (w) => {
        if (s[w]) {
          total -= 5;
        }
      }
    );

    total += s.Online_Progress_Value || 0;
    total += s.Bonus_Points || 0;

    if (s.Level_Drop_Checked) {
      total -= s.Level_Drop_Value || 0;
    }

    return total;
  }

  async function updateField(
    id: string,
    field: string,
    value: any
  ) {
    await supabase
      .from("history_records")
      .update({
        [field]: value,
      })
      .eq("id", id);

    // RECALCULATE DAILY TOTAL
    const { data } = await supabase
      .from("history_records")
      .select("*")
      .eq("id", id)
      .single();

    if (!data) return;

    const newTotal =
      calculateDailyTotal(data);

    await supabase
      .from("history_records")
      .update({
        Daily_Total: newTotal,
      })
      .eq("id", id);

    fetchHistory();
  }

  const numberOptions = [
    -3,
    -2,
    -1,
    0,
    1,
    2,
    3,
  ];

  return (
    <div style={{ padding: 20 }}>
      <h1>History</h1>

      <a href="/">
        <button style={{ marginBottom: 20 }}>
          ← Back to Point Sheet
        </button>
      </a>

      <table border={1} cellPadding={6}>
        <thead>
          <tr>
            <th>Attend</th>

            <th>Name</th>
            <th>Group</th>
            <th>Date</th>

            <th>Title AM</th>
            <th>Circle AM</th>

            <th>A</th>
            <th>B</th>
            <th>C</th>
            <th>D</th>
            <th>Lunch</th>
            <th>E</th>
            <th>F</th>

            <th>Title PM</th>
            <th>Circle PM</th>

            <th>WotD</th>
            <th>Suspension</th>

            <th>Online</th>
            <th>Bonus</th>

            <th>W1</th>
            <th>W2</th>
            <th>W3</th>

            <th>Daily Total</th>
            <th>Running Total</th>
            <th>Level</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((s) => {
            // SPACER ROW
            if (s.isSpacer) {
              return (
                <tr key={s.id}>
                  <td
                    colSpan={26}
                    style={{
                      height: "20px",
                      border: "none",
                      background: "transparent",
                    }}
                  />
                </tr>
              );
            }

            const attendance =
              s.Attendance ?? true;

            return (
              <tr key={s.id}>
                {/* ATTENDANCE */}
                <td>
                  <input
                    type="checkbox"
                    checked={attendance}
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "Attendance",
                        e.target.checked
                      )
                    }
                  />
                </td>

                <td>{s.Student_Name}</td>

                {/* GROUP */}
                <td>{s.Class_Group}</td>

                {/* DATE */}
                <td>{s.School_Date}</td>

                {/* TITLE AM */}
                <td>
                  <select
                    disabled={!attendance}
                    value={s.Title_AM || 0}
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "Title_AM",
                        Number(e.target.value)
                      )
                    }
                  >
                    {numberOptions.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </td>

                {/* CIRCLE AM */}
                <td>
                  <input
                    disabled={!attendance}
                    type="checkbox"
                    checked={s.Circle_AM || false}
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "Circle_AM",
                        e.target.checked
                      )
                    }
                  />
                </td>

                {/* PERIODS */}
                {[
                  "Period_A",
                  "Period_B",
                  "Period_C",
                  "Period_D",
                  "Lunch_Period",
                  "Period_E",
                  "Period_F",
                ].map((p) => (
                  <td key={p}>
                    <select
                      disabled={!attendance}
                      value={s[p] || 0}
                      onChange={(e) =>
                        updateField(
                          s.id,
                          p,
                          Number(e.target.value)
                        )
                      }
                    >
                      {numberOptions.map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </td>
                ))}

                {/* TITLE PM */}
                <td>
                  <select
                    disabled={!attendance}
                    value={s.Title_PM || 0}
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "Title_PM",
                        Number(e.target.value)
                      )
                    }
                  >
                    {numberOptions.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </td>

                {/* CIRCLE PM */}
                <td>
                  <input
                    disabled={!attendance}
                    type="checkbox"
                    checked={s.Circle_PM || false}
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "Circle_PM",
                        e.target.checked
                      )
                    }
                  />
                </td>

                {/* WOTD */}
                <td>
                  <input
                    type="checkbox"
                    checked={s.WotD || false}
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "WotD",
                        e.target.checked
                      )
                    }
                  />
                </td>

                {/* SUSPENSION */}
                <td>
                  <select
                    value={s.Suspension || ""}
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "Suspension",
                        e.target.value
                      )
                    }
                  >
                    <option value=""></option>
                    <option>Suspended</option>
                    <option>Unexcused</option>
                  </select>
                </td>

                {/* ONLINE */}
                <td>
                  <input
                    type="number"
                    value={
                      s.Online_Progress_Value || 0
                    }
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "Online_Progress_Value",
                        Number(e.target.value)
                      )
                    }
                  />
                </td>

                {/* BONUS */}
                <td>
                  <input
                    type="number"
                    value={s.Bonus_Points || 0}
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "Bonus_Points",
                        Number(e.target.value)
                      )
                    }
                  />
                </td>

                {/* WRITEUPS */}
                {[
                  "WriteUp_1",
                  "WriteUp_2",
                  "WriteUp_3",
                ].map((w) => (
                  <td key={w}>
                    <select
                      value={s[w] || ""}
                      onChange={(e) =>
                        updateField(
                          s.id,
                          w,
                          e.target.value
                        )
                      }
                    >
                      <option value=""></option>

                      {[
                        "IL",
                        "PA",
                        "DE",
                        "DI",
                        "DC",
                        "SM",
                        "AL",
                        "HP",
                        "H/B",
                        "OB",
                        "C",
                        "O",
                      ].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                ))}

                {/* DAILY TOTAL */}
                <td>{s.Daily_Total}</td>

                {/* RUNNING TOTAL */}
                <td>{s.Running_Total}</td>

                {/* LEVEL */}
                <td>{s.Level}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}