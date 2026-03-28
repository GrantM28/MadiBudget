const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMoney(value) {
  return currency.format(Number(value || 0));
}

export default function Dashboard({ dashboard, plan, month }) {
  if (!dashboard || !plan) {
    return null;
  }

  const safeClass =
    Number(dashboard.safe_to_spend_after_budgeted_categories) >= 0
      ? "safe-positive"
      : "safe-negative";

  const safeStatus =
    Number(dashboard.safe_to_spend_after_budgeted_categories) >= 0
      ? "Within plan"
      : "Over plan";

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <div>
          <p className="section-kicker">Monthly overview</p>
          <h2 className="dashboard-title">Budget position for {month}</h2>
          <p className="section-subtitle">
            Safe-to-spend uses full allowance budgets, not just what has already been spent.
          </p>
        </div>

        <div className={`safe-status-chip ${safeClass}`}>
          <span className="safe-status-label">Status</span>
          <strong>{safeStatus}</strong>
        </div>
      </div>

      <div className="metrics-grid">
        <article className="metric-card">
          <div className="metric-label">Monthly Income</div>
          <div className="metric-value">{formatMoney(dashboard.monthly_income)}</div>
          <div className="metric-note">Converted from weekly, biweekly, and monthly pay.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Total Bills</div>
          <div className="metric-value">{formatMoney(dashboard.total_bills)}</div>
          <div className="metric-note">
            Includes Chapter 13 and all regular bills.
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Chapter 13</div>
          <div className="metric-value">
            {formatMoney(dashboard.chapter13_payment_total)}
          </div>
          <div className="metric-note">Protected as a required monthly obligation.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Allowances</div>
          <div className="metric-value">{formatMoney(dashboard.total_allowances)}</div>
          <div className="metric-note">Uses budgeted category totals, not actual spend.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Safe To Spend</div>
          <div className={`metric-value ${safeClass}`}>
            {formatMoney(dashboard.safe_to_spend_after_budgeted_categories)}
          </div>
          <div className="metric-note">The cushion left after bills and full allowance budgets.</div>
        </article>
      </div>

      <div className="dashboard-lower">
        <article className="section-card">
          <div className="section-title-row">
            <div>
              <h2>Allowance Categories</h2>
              <p className="section-subtitle">
                Budget, spent, and remaining for the selected month.
              </p>
            </div>
          </div>

          {dashboard.remaining_per_category.length === 0 ? (
            <p className="empty-state">
              No allowance categories yet. Add them before entering transactions.
            </p>
          ) : (
            <div className="budget-table-wrap">
              <table className="budget-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Budget</th>
                    <th>Spent</th>
                    <th>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.remaining_per_category.map((category) => {
                    const remainingClass =
                      Number(category.remaining) < 0 ? "negative" : "positive";

                    return (
                      <tr key={category.category_id}>
                        <td className="budget-table-category">{category.category_name}</td>
                        <td>{formatMoney(category.budget)}</td>
                        <td>{formatMoney(category.spent)}</td>
                        <td className={`category-remaining ${remainingClass}`}>
                          {formatMoney(category.remaining)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <aside className="section-card">
          <div className="section-title-row">
            <div>
              <h2>Planning Summary</h2>
              <p className="section-subtitle">
                Conservative guardrails for required spending and category budgets.
              </p>
            </div>
          </div>

          <div className="summary-stack">
            <div className="summary-tile">
              <span className="summary-list-label">Actual Category Spend</span>
              <strong>{formatMoney(plan.total_spent_in_allowance_categories)}</strong>
            </div>

            <div className="summary-tile">
              <span className="summary-list-label">Buffer After Bills</span>
              <strong>{formatMoney(plan.buffer_after_bills)}</strong>
            </div>

            <div className="summary-tile summary-tile-safe">
              <span className="summary-list-label">Safe To Spend</span>
              <strong>{formatMoney(plan.safe_to_spend_after_budgeted_categories)}</strong>
            </div>

            <div className="summary-tile summary-tile-warning">
              <span className="summary-list-label">After Actual Spending</span>
              <strong>{formatMoney(plan.buffer_after_actual_spending)}</strong>
            </div>
          </div>

          <div className="rules-card">
            <span className="summary-list-label">Budget Rules</span>
            <ul className="rules-list">
              <li>Every transaction must use an existing allowance category.</li>
              <li>Chapter 13 is counted as a protected required bill.</li>
              <li>Safe-to-spend reserves the full monthly category budgets.</li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
