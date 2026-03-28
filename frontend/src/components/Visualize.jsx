import { useMemo, useState } from "react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMoney(value) {
  return currency.format(Number(value || 0));
}

function getSeriesColor(index) {
  const palette = [
    "#5ea2ff",
    "#55d3a4",
    "#f7b955",
    "#f07b72",
    "#b38cff",
    "#4fd2df",
    "#ff8f5e",
    "#8fd66a",
    "#d88cff",
    "#7fb0ff",
  ];

  return palette[index % palette.length];
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function buildArcPath(x, y, radius, startAngle, endAngle) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${x} ${y}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function DoughnutChart({ data, metric }) {
  const total = data.reduce((sum, item) => sum + Math.abs(item.value), 0);
  const radius = 128;
  const center = 160;
  let currentAngle = 0;

  if (total === 0) {
    return <div className="chart-empty">No chartable values for the current filters.</div>;
  }

  return (
    <div className="chart-shell">
      <svg className="chart-svg" viewBox="0 0 320 320" role="img" aria-label="Doughnut chart">
        <circle cx={center} cy={center} r={radius} fill="#101722" />
        {data.map((item, index) => {
          const sliceAngle = (Math.abs(item.value) / total) * 360;
          const startAngle = currentAngle;
          const endAngle = currentAngle + sliceAngle;
          currentAngle = endAngle;

          if (data.length === 1) {
            return (
              <circle
                key={item.label}
                cx={center}
                cy={center}
                r={radius}
                fill={getSeriesColor(index)}
                stroke="#0f141b"
                strokeWidth="2"
              />
            );
          }

          return (
            <path
              key={item.label}
              d={buildArcPath(center, center, radius, startAngle, endAngle)}
              fill={getSeriesColor(index)}
              stroke="#0f141b"
              strokeWidth="2"
            />
          );
        })}
        <circle cx={center} cy={center} r="78" fill="#121923" stroke="#273242" />
        <text x="160" y="145" textAnchor="middle" className="chart-center-label">
          Total
        </text>
        <text x="160" y="178" textAnchor="middle" className="chart-center-value">
          {formatMoney(total)}
        </text>
      </svg>
      {metric === "net" ? (
        <div className="chart-note">Net doughnut uses absolute magnitudes for slice size.</div>
      ) : null}
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map((item) => Math.abs(item.value)), 0);

  if (!max) {
    return <div className="chart-empty">No chartable values for the current filters.</div>;
  }

  return (
    <div className="bar-chart-list">
      {data.map((item, index) => {
        const width = `${(Math.abs(item.value) / max) * 100}%`;
        return (
          <div className="bar-chart-row" key={item.label}>
            <div className="bar-chart-meta">
              <span className="bar-chart-label">{item.label}</span>
              <span className="bar-chart-value">{formatMoney(Math.abs(item.value))}</span>
            </div>
            <div className="bar-chart-track">
              <div
                className="bar-chart-fill"
                style={{
                  width,
                  background: getSeriesColor(index),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ data }) {
  const values = data.map((item) => item.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  if (!data.length) {
    return <div className="chart-empty">No chartable values for the current filters.</div>;
  }

  const width = 760;
  const height = 280;
  const paddingX = 44;
  const paddingY = 30;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;

  const points = data.map((item, index) => {
    const x =
      paddingX + (data.length === 1 ? usableWidth / 2 : (usableWidth * index) / (data.length - 1));
    const y = paddingY + usableHeight - ((item.value - min) / range) * usableHeight;
    return { ...item, x, y };
  });

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div className="chart-shell chart-shell-line">
      <svg className="chart-svg chart-svg-line" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line chart">
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} className="chart-axis" />
        <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} className="chart-axis" />
        <path d={path} className="chart-line-path" />
        {points.map((point, index) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill={getSeriesColor(index)} />
            <text x={point.x} y={height - 8} textAnchor="middle" className="chart-x-label">
              {point.shortLabel}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function Visualize({ transactions, month, categories }) {
  const [chartType, setChartType] = useState("doughnut");
  const [groupBy, setGroupBy] = useState("description");
  const [metric, setMetric] = useState("expense");
  const [selectedDescriptions, setSelectedDescriptions] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [search, setSearch] = useState("");
  const [topN, setTopN] = useState("8");

  const descriptionOptions = useMemo(() => {
    const uniqueDescriptions = [...new Set(transactions.map((transaction) => transaction.description.trim()))];
    return uniqueDescriptions.sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const filteredDescriptionOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return descriptionOptions;
    }

    return descriptionOptions.filter((description) =>
      description.toLowerCase().includes(normalizedSearch),
    );
  }, [descriptionOptions, search]);

  const selectedCategoriesSet = new Set(selectedCategoryIds.map(String));
  const selectedDescriptionsSet = new Set(selectedDescriptions);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesDescription =
        selectedDescriptions.length === 0 || selectedDescriptionsSet.has(transaction.description);
      const matchesCategory =
        selectedCategoryIds.length === 0 || selectedCategoriesSet.has(String(transaction.category_id));

      return matchesDescription && matchesCategory;
    });
  }, [transactions, selectedDescriptions, selectedCategoryIds]);

  const chartData = useMemo(() => {
    const groups = new Map();

    filteredTransactions.forEach((transaction) => {
      let contribution = 0;

      if (metric === "expense") {
        contribution = transaction.transaction_type === "expense" ? Number(transaction.amount) : 0;
      } else if (metric === "income") {
        contribution = transaction.transaction_type === "income" ? Number(transaction.amount) : 0;
      } else {
        contribution =
          transaction.transaction_type === "income"
            ? Number(transaction.amount)
            : Number(transaction.amount) * -1;
      }

      if (contribution === 0) {
        return;
      }

      let label = transaction.description;
      let sortKey = transaction.description;
      let shortLabel = transaction.description.slice(0, 10);

      if (groupBy === "category") {
        label = transaction.category_name;
        sortKey = transaction.category_name;
        shortLabel = transaction.category_name.slice(0, 10);
      } else if (groupBy === "day") {
        label = transaction.date;
        sortKey = transaction.date;
        shortLabel = transaction.date.slice(5);
      }

      const existing = groups.get(label) || {
        label,
        shortLabel,
        sortKey,
        value: 0,
      };
      existing.value += contribution;
      groups.set(label, existing);
    });

    const result = [...groups.values()];
    if (groupBy === "day") {
      result.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    } else {
      result.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    }

    const limit = Number(topN) || result.length;
    return result.slice(0, limit);
  }, [filteredTransactions, groupBy, metric, topN]);

  const summary = useMemo(() => {
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    const absoluteTotal = chartData.reduce((sum, item) => sum + Math.abs(item.value), 0);
    const largest = chartData[0];

    return {
      total,
      absoluteTotal,
      largest,
      count: filteredTransactions.length,
      seriesCount: chartData.length,
    };
  }, [chartData, filteredTransactions.length]);

  function toggleDescription(description) {
    setSelectedDescriptions((current) =>
      current.includes(description)
        ? current.filter((item) => item !== description)
        : [...current, description],
    );
  }

  function toggleCategory(categoryId) {
    const value = String(categoryId);
    setSelectedCategoryIds((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function clearFilters() {
    setSelectedDescriptions([]);
    setSelectedCategoryIds([]);
    setSearch("");
  }

  return (
    <section className="visualize-layout">
      <aside className="visualize-builder">
        <div className="section-title-row">
          <div>
            <p className="section-kicker">Visual Builder</p>
            <h2>Make your own chart</h2>
            <p className="section-subtitle">
              Build custom visuals from {month} transactions, refunds, and money-in activity.
            </p>
          </div>
        </div>

        <div className="visualize-panel">
          <div className="field">
            <label>Chart Type</label>
            <div className="segmented-control">
              {[
                ["doughnut", "Pie"],
                ["bar", "Bar"],
                ["line", "Graph"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`segment-button ${chartType === value ? "active" : ""}`}
                  onClick={() => setChartType(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Group By</label>
            <div className="segmented-control">
              {[
                ["description", "Transaction Name"],
                ["category", "Category"],
                ["day", "Day"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`segment-button ${groupBy === value ? "active" : ""}`}
                  onClick={() => setGroupBy(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Metric</label>
            <div className="segmented-control">
              {[
                ["expense", "Spend"],
                ["income", "Money In"],
                ["net", "Net Flow"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`segment-button ${metric === value ? "active" : ""}`}
                  onClick={() => setMetric(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="visual-topn">Show Top Rows</label>
            <select
              id="visual-topn"
              value={topN}
              onChange={(event) => setTopN(event.target.value)}
            >
              <option value="5">Top 5</option>
              <option value="8">Top 8</option>
              <option value="12">Top 12</option>
              <option value="20">Top 20</option>
              <option value="999">All</option>
            </select>
          </div>
        </div>

        <div className="visualize-panel">
          <div className="visualize-filter-head">
            <div>
              <h3>Transaction Names</h3>
              <p>Select places like Sonic, McDonalds, Amazon, Venmo, and compare them.</p>
            </div>
            <button type="button" className="table-action-button" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>

          <div className="field">
            <label htmlFor="visual-search">Search Names</label>
            <input
              id="visual-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search transaction names"
            />
          </div>

          <div className="filter-chip-grid">
            {filteredDescriptionOptions.slice(0, 28).map((description) => (
              <button
                key={description}
                type="button"
                className={`filter-chip ${selectedDescriptionsSet.has(description) ? "active" : ""}`}
                onClick={() => toggleDescription(description)}
              >
                {description}
              </button>
            ))}
          </div>
        </div>

        <div className="visualize-panel">
          <div className="visualize-filter-head">
            <div>
              <h3>Categories</h3>
              <p>Narrow the data to specific budget categories if you want.</p>
            </div>
          </div>
          <div className="filter-chip-grid">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`filter-chip ${selectedCategoriesSet.has(String(category.id)) ? "active" : ""}`}
                onClick={() => toggleCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="visualize-stage">
        <section className="visualize-hero">
          <div className="visualize-hero-copy">
            <p className="section-kicker">Visualization Lab</p>
            <h2>Turn transactions into a chart you can actually use</h2>
            <p className="section-subtitle">
              Use this to answer questions like how much you spent at fast food places,
              how much came back in through refunds, or which categories are actually
              eating the month alive.
            </p>
          </div>

          <div className="visualize-summary-grid">
            <article className="summary-tile">
              <span className="summary-list-label">Matched Transactions</span>
              <strong>{summary.count}</strong>
            </article>
            <article className="summary-tile">
              <span className="summary-list-label">Series Count</span>
              <strong>{summary.seriesCount}</strong>
            </article>
            <article className="summary-tile summary-tile-safe">
              <span className="summary-list-label">
                {metric === "net" ? "Net Total" : "Chart Total"}
              </span>
              <strong>{formatMoney(metric === "net" ? summary.total : summary.absoluteTotal)}</strong>
            </article>
            <article className="summary-tile">
              <span className="summary-list-label">Largest Bucket</span>
              <strong>{summary.largest ? summary.largest.label : "None"}</strong>
            </article>
          </div>
        </section>

        <section className="section-card visualize-chart-card">
          <div className="section-title-row">
            <div>
              <h2>Chart Preview</h2>
              <p className="section-subtitle">
                {groupBy === "description"
                  ? "Comparing transaction names."
                  : groupBy === "category"
                    ? "Comparing budget categories."
                    : "Showing daily movement across the month."}
              </p>
            </div>
            <span className="section-count">{chartType}</span>
          </div>

          {chartType === "doughnut" ? <DoughnutChart data={chartData} metric={metric} /> : null}
          {chartType === "bar" ? <BarChart data={chartData} /> : null}
          {chartType === "line" ? <LineChart data={chartData} /> : null}
        </section>

        <section className="section-card visualize-chart-card">
          <div className="section-title-row">
            <div>
              <h2>Series Breakdown</h2>
              <p className="section-subtitle">
                Every bucket currently included in the visualization.
              </p>
            </div>
            <span className="section-count">{chartData.length}</span>
          </div>

          {chartData.length === 0 ? (
            <p className="empty-state">No data matches the current chart settings.</p>
          ) : (
            <div className="visualize-breakdown">
              {chartData.map((item, index) => (
                <div className="visualize-breakdown-row" key={item.label}>
                  <div className="visualize-breakdown-main">
                    <span
                      className="visualize-swatch"
                      style={{ background: getSeriesColor(index) }}
                    />
                    <div>
                      <div className="visualize-breakdown-label">{item.label}</div>
                      <div className="visualize-breakdown-subtitle">
                        {groupBy === "day" ? "Daily bucket" : "Filtered bucket"}
                      </div>
                    </div>
                  </div>
                  <div className="visualize-breakdown-value">
                    {metric === "net" ? (
                      item.value >= 0 ? `+${formatMoney(item.value)}` : `-${formatMoney(Math.abs(item.value))}`
                    ) : (
                      formatMoney(Math.abs(item.value))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
