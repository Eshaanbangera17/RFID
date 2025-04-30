import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import PropTypes from 'prop-types';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "./supabase";
import "./app.css";

const Card = ({ children, className = "" }) => (
  <motion.div
    className={`card ${className}`}
    whileHover={{ scale: 1.02 }}
    transition={{ type: "spring", stiffness: 300 }}
  >
    {children}
  </motion.div>
);
Card.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

const CardContent = ({ children, className = "" }) => (
  <div className={`card-content ${className}`}>{children}</div>
);
CardContent.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

const Button = ({ children, onClick, className = "" }) => (
  <motion.button
    onClick={onClick}
    className={`button ${className}`}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    {children}
  </motion.button>
);
Button.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
  className: PropTypes.string
};

const ProgressBar = ({ value, max }) => {
  const percentage = (value / max) * 100;
  let bgColor;
  if (percentage < 50) bgColor = "#F44336";
  else if (percentage < 80) bgColor = "#FFA500";
  else bgColor = "#4CAF50";

  return (
    <div className="progress-container">
      <div
        className="progress-inner"
        style={{ width: `${percentage}%`, backgroundColor: bgColor }}
      />
    </div>
  );
};
ProgressBar.propTypes = {
  value: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired
};

// Data Aggregation: only "completed" counts from logs
const processWeeklyData = (logs) => {
  const weekly = {};
  logs.forEach((log) => {
    const dateObj = new Date(log.timestamp);
    const day = dateObj.toLocaleString("en-US", { weekday: "long" });
    weekly[day] = weekly[day] || { day, completed: 0 };
    weekly[day].completed++;
  });
  return Object.values(weekly);
};
const processMonthlyData = (logs) => {
  const monthly = {};
  logs.forEach((log) => {
    const dateObj = new Date(log.timestamp);
    const month = dateObj.toLocaleString("en-US", { month: "long" });
    monthly[month] = monthly[month] || { month, completed: 0 };
    monthly[month].completed++;
  });
  return Object.values(monthly);
};

export default function GuardPatrollingDashboard() {
  const [guards, setGuards] = useState([]);
  const [selectedGuard, setSelectedGuard] = useState(null);
  const [patrolHistory, setPatrolHistory] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [chartType, setChartType] = useState("weekly");

  useEffect(() => {
    async function fetchGuards() {
      const { data, error } = await supabase.from("admin_data").select("*");
      if (error) console.error("Error fetching guards:", error);
      else if (data) {
        setGuards(data);
        setSelectedGuard(data[0] || null);
      }
    }
    fetchGuards();
  }, []);

  useEffect(() => {
    if (!selectedGuard) return;
    async function fetchPatrols() {
      const { data, error } = await supabase
        .from("patrol_logs")
        .select(`
          timestamp,
          tag_id_data ( name )
        `)
        .eq("admin_id", selectedGuard.admin_id);
      if (error) console.error("Error fetching patrols:", error);
      else if (data) {
        // map to unified format
        const formatted = data.map((log) => ({
          timestamp: log.timestamp,
          location: log.tag_id_data?.name || log.checkpoint_id,
        }));
        setPatrolHistory(formatted);
        setWeeklyData(processWeeklyData(formatted));
        setMonthlyData(processMonthlyData(formatted));
      }
    }
    fetchPatrols();
  }, [selectedGuard]);

  // CSV Export
  const exportCSV = () => {
    if (!patrolHistory.length) return;
    const header = ["Date", "Time", "Location"];
    const rows = patrolHistory.map((log) => {
      const dt = new Date(log.timestamp);
      return [
        dt.toLocaleDateString(),
        dt.toLocaleTimeString(),
        log.location,
      ];
    });
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedGuard.admin_id}_patrol_history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // PDF Export
  const exportPDF = () => {
    if (!patrolHistory.length) return;
    const doc = new jsPDF();
    doc.text("Patrol Log History", 14, 20);
    const cols = ["Date", "Time", "Location"];
    const rows = patrolHistory.map((log) => {
      const dt = new Date(log.timestamp);
      return [
        dt.toLocaleDateString(),
        dt.toLocaleTimeString(),
        log.location,
      ];
    });
    autoTable(doc, { head: [cols], body: rows, startY: 30 });
    doc.save(`${selectedGuard.admin_id}_patrol_history.pdf`);
  };

  return (
    <motion.div className="dashboard-container" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <header className="dashboard-header">
        <h1>SmartDwell Technology</h1>
        <h2>Guard Patrolling System</h2>
      </header>

      <Card className="log-card">
        <CardContent>
          <h3 className="section-title">Patrol Log History</h3>
          <table className="log-table">
            <thead>
              <tr><th>Date</th><th>Time</th><th>Location</th></tr>
            </thead>
            <tbody>
              {patrolHistory.length ? (
                patrolHistory.map((log, i) => {
                  const dt = new Date(log.timestamp);
                  return (
                    <tr key={i}>
                      <td>{dt.toLocaleDateString()}</td>
                      <td>{dt.toLocaleTimeString()}</td>
                      <td>{log.location}</td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan="3">No log data available</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="guard-button-container">
        {guards.map(g => (
          <Button key={g.admin_id} onClick={() => setSelectedGuard(g)}>
            {g.name}
          </Button>
        ))}
      </div>

      {selectedGuard && (
        <Card className="guard-card">
          <CardContent>
            <h2>{selectedGuard.name}</h2>
            <p>ID: {selectedGuard.admin_id}</p>
          </CardContent>
        </Card>
      )}

      <div className="chart-toggle-container">
        <Button onClick={() => setChartType("weekly")} className={chartType === "weekly" ? "active" : ""}>Weekly</Button>
        <Button onClick={() => setChartType("monthly")} className={chartType === "monthly" ? "active" : ""}>Monthly</Button>
      </div>

      <Card className="chart-card">
        <CardContent>
          <h3 className="section-title">{chartType === "weekly" ? "Weekly Patrols" : "Monthly Patrols"}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartType === "weekly" ? weeklyData : monthlyData}>
              <XAxis dataKey={chartType === "weekly" ? "day" : "month"} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="completed" name="Visits" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="export-container">
        <Button onClick={exportCSV}>Export CSV</Button>
        <Button onClick={exportPDF}>Export PDF</Button>
      </div>
    </motion.div>
  );
}
