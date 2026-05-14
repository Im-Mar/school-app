"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PointSheet() {
  const [students, setStudents] = useState<any[]>([]);
  const [runningTotals, setRunningTotals] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    // DAILY RECORDS
    const { data, error } = await supabase
      .from("daily_records")
      .select("*");

    if (error || !data) {
      console.error("DAILY RECORD ERROR:", error);
      return;
    }

    // HISTORY RECORDS
    const {
      data: historyData,
      error: historyError,
    } = await supabase
      .from("history_records")
      .select("*");

    // BUILD RUNNING TOTALS
    const totals: Record<string, number> = {};

    if (!historyError && historyData) {
      historyData.forEach((h: any) => {
        const studentName = h.Student_Name;

        if (!totals[studentName]) {
          totals[studentName] = 0;
        }

        totals[studentName] += h.Daily_Total || 0;

        // prevent negative running totals
        if (totals[studentName] < 0) {
          totals[studentName] = 0;
        }
      });
    }

    setRunningTotals(totals);

    // GROUP ORDER
    const groupOrder: Record<string, number> = {
      MS: 0,
      "9th": 1,
      "10th": 2,
      "11th": 3,
      "12th": 4,
    };

    // SORT
    const sorted = [...data].sort((a, b) => {
      const groupCompare =
        (groupOrder[a.Class_Group] ?? 999) -
        (groupOrder[b.Class_Group] ?? 999);

      if (groupCompare !== 0) {
        return groupCompare;
      }

      return (a.Student_Name || "").localeCompare(
        b.Student_Name || ""
      );
    });

    // ADD SPACERS
    const grouped: any[] = [];
    let currentGroup = "";

    sorted.forEach((student) => {
      if (student.Class_Group !== currentGroup) {
        currentGroup = student.Class_Group;

        if (grouped.length > 0) {
          grouped.push({
            id: `spacer-${currentGroup}`,
            isSpacer: true,
          });
        }
      }

      grouped.push(student);
    });

    setStudents(grouped);
  }

  // DAILY TOTAL
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

    // allow negatives,
    // but not below negative running total
    const historyTotal =
      runningTotals[s.Student_Name] || 0;

    const minimumAllowed = -historyTotal;

    if (total < minimumAllowed) {
      total = minimumAllowed;
    }

    return total;
  }

  // OVERALL TOTAL
  function calculateOverallTotal(s: any) {
    const historyTotal =
      runningTotals[s.Student_Name] || 0;

    return (
      historyTotal + calculateDailyTotal(s)
    );
  }

  // UPDATE FIELD
  async function updateField(
    id: string,
    field: string,
    value: any
  ) {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, [field]: value }
          : s
      )
    );

    await supabase
      .from("daily_records")
      .update({ [field]: value })
      .eq("id", id);

    fetchData();
  }

  // RESET DAY
  async function resetDay() {
    const { data: students, error } =
      await supabase
        .from("daily_records")
        .select("*");

    if (error || !students) {
      console.error("RESET ERROR:", error);
      return;
    }

    // COPY TO HISTORY
    const historyPayload = students.map((s) => ({
      student_id: s.id,

      Student_Name: s.Student_Name,
      Class_Group: s.Class_Group,
      School_Date: s.School_Date,
      Attendance: s.Attendance,

       
       
      Title_AM: s.Title_AM,
      Circle_AM: s.Circle_AM,

      Period_A: s.Period_A,
      Period_B: s.Period_B,
      Period_C: s.Period_C,
      Period_D: s.Period_D,
      Lunch_Period: s.Lunch_Period,
      Period_E: s.Period_E,
      Period_F: s.Period_F,

      Title_PM: s.Title_PM,
      Circle_PM: s.Circle_PM,

      WotD: s.WotD,
      Suspension: s.Suspension,

      Online_Progress_Value:
        s.Online_Progress_Value,

      Bonus_Points: s.Bonus_Points,

      WriteUp_1: s.WriteUp_1,
      WriteUp_2: s.WriteUp_2,
      WriteUp_3: s.WriteUp_3,

      Level_Drop_Checked:
        s.Level_Drop_Checked,

      Level_Drop_Value:
        s.Level_Drop_Value,

      Daily_Total:
        calculateDailyTotal(s),
    }));

    const { error: insertError } =
      await supabase
        .from("history_records")
        .insert(historyPayload);

    if (insertError) {
      console.error(
        "INSERT FAILED:",
        insertError
      );
      return;
    }

    const today = new Date()
      .toISOString()
      .split("T")[0];

    // RESET RECORDS
    for (const s of students) {
      await supabase
        .from("daily_records")
        .update({
          School_Date: today,
          

          Attendance: true,

          Title_AM: 0,
          Circle_AM: false,

          Period_A: 0,
          Period_B: 0,
          Period_C: 0,
          Period_D: 0,
          Lunch_Period: 0,
          Period_E: 0,
          Period_F: 0,

          Title_PM: 0,
          Circle_PM: false,

          WotD: false,

          Suspension: "",

          Online_Progress_Value: 0,
          Bonus_Points: 0,

          WriteUp_1: "",
          WriteUp_2: "",
          WriteUp_3: "",

          Level_Drop_Checked: false,

          Daily_Total: 0,
        })
        .eq("id", s.id);
    }

    await fetchData();
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
      <h1>Point Sheet</h1>

      <a href="/history">
        <button style={{ marginBottom: 10 }}>
          Go to History
        </button>
      </a>

      <button
        onClick={resetDay}
        style={{
          marginBottom: 20,
          background: "red",
          color: "white",
          padding: "10px",
          marginLeft: "10px",
        }}
      >
        RESET DAY
      </button>

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
            <th>Total</th>
          </tr>
        </thead>

        <tbody>
          {students.map((s) => {
            if (s.isSpacer) {
              return (
                <tr key={s.id}>
                  <td
                    colSpan={24}
                    style={{
                      height: "20px",
                      border: "none",
                      background:
                        "transparent",
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
                <td>
                  <select
                    value={
                      s.Class_Group || ""
                    }
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "Class_Group",
                        e.target.value
                      )
                    }
                  >
                    {[
                      "MS",
                      "9th",
                      "10th",
                      "11th",
                      "12th",
                    ].map((g) => (
                      <option key={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </td>

                {/* DATE */}
                <td>
                  <input
                    type="date"
                    value={
                      s.School_Date || ""
                    }
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "School_Date",
                        e.target.value
                      )
                    }
                  />
                </td>

                {/* TITLE AM */}
                <td>
                  <select
                    disabled={!attendance}
                    value={
                      s.Title_AM || 0
                    }
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "Title_AM",
                        Number(
                          e.target.value
                        )
                      )
                    }
                  >
                    {numberOptions.map(
                      (n) => (
                        <option key={n}>
                          {n}
                        </option>
                      )
                    )}
                  </select>
                </td>

                {/* CIRCLE AM */}
                <td>
                  <input
                    disabled={!attendance}
                    type="checkbox"
                    checked={
                      s.Circle_AM || false
                    }
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
                          Number(
                            e.target.value
                          )
                        )
                      }
                    >
                      {numberOptions.map(
                        (n) => (
                          <option key={n}>
                            {n}
                          </option>
                        )
                      )}
                    </select>
                  </td>
                ))}

                {/* TITLE PM */}
                <td>
                  <select
                    disabled={!attendance}
                    value={
                      s.Title_PM || 0
                    }
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "Title_PM",
                        Number(
                          e.target.value
                        )
                      )
                    }
                  >
                    {numberOptions.map(
                      (n) => (
                        <option key={n}>
                          {n}
                        </option>
                      )
                    )}
                  </select>
                </td>

                {/* CIRCLE PM */}
                <td>
                  <input
                    disabled={!attendance}
                    type="checkbox"
                    checked={
                      s.Circle_PM || false
                    }
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
                    checked={
                      s.WotD || false
                    }
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
                    value={
                      s.Suspension || ""
                    }
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "Suspension",
                        e.target.value
                      )
                    }
                  >
                    <option value="">
                    </option>
                    <option>
                      Suspended
                    </option>
                    <option>
                      Unexcused
                    </option>
                  </select>
                </td>

                {/* ONLINE */}
                <td>
                  <input
                    type="number"
                    value={
                      s.Online_Progress_Value ||
                      0
                    }
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "Online_Progress_Value",
                        Number(
                          e.target.value
                        )
                      )
                    }
                  />
                </td>

                {/* BONUS */}
                <td>
                  <input
                    type="number"
                    value={
                      s.Bonus_Points || 0
                    }
                    onChange={(e) =>
                      updateField(
                        s.id,
                        "Bonus_Points",
                        Number(
                          e.target.value
                        )
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
                      <option value="">
                      </option>

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
                        <option key={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}

                <td>
                  {calculateDailyTotal(s)}
                </td>

                <td>
                  {calculateOverallTotal(s)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}