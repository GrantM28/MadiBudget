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
      ? "On track"
      : "Needs attention";

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <div>
          <p className="section-kicker">Overview</p>
          <h2 className="dashboard-title">Budget snapshot for {month}</h2>
          <p className="section-subtitle">
            Safe-to-spend is based on income, total bills, and full category budgets.
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
          <div className="metric-note">Recurring income plus variable income recorded this month.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Recurring Income</div>
          <div className="metric-value">{formatMoney(dashboard.recurring_monthly_income)}</div>
          <div className="metric-note">Baseline monthly estimate from your regular income sources.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Variable Income</div>
          <div className="metric-value">{formatMoney(dashboard.variable_income_total)}</div>
          <div className="metric-note">Overtime, commissions, bonuses, and other extra pay this month.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Total Bills</div>
          <div className="metric-value">{formatMoney(dashboard.total_bills)}</div>
          <div className="metric-note">All tracked monthly bills and obligations.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Category Budgets</div>
          <div className="metric-value">{formatMoney(dashboard.total_allowances)}</div>
          <div className="metric-note">Reserved using the full monthly category plan.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Net Category Spend</div>
          <div className="metric-value">
            {formatMoney(dashboard.total_spent_in_allowance_categories)}
          </div>
          <div className="metric-note">Expenses minus refunds or other money back into categories.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Safe To Spend</div>
          <div className={`metric-value ${safeClass}`}>
            {formatMoney(dashboard.safe_to_spend_after_budgeted_categories)}
          </div>
          <div className="metric-note">Cash left after bills and budgeted categories.</div>
        </article>
      </div>

      <div className="dashboard-lower">
        <article className="section-card">
          <div className="section-title-row">
            <div>
              <h2>Category Balances</h2>
              <p className="section-subtitle">
                Remaining amounts for each budget category in the selected month.
              </p>
            </div>
          </div>

          {dashboard.remaining_per_category.length === 0 ? (
            <p className="empty-state">
              No categories yet. Add categories before recording transactions.
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
              <h2>Cash Flow Summary</h2>
              <p className="section-subtitle">
                A quick read on what is protected, spent, and still available.
              </p>
            </div>
          </div>

          <div className="summary-stack">
            <div className="summary-tile">
              <span className="summary-list-label">Buffer After Bills</span>
              <strong>{formatMoney(plan.buffer_after_bills)}</strong>
            </div>

            <div className="summary-tile">
              <span className="summary-list-label">Actual Category Spend</span>
              <strong>{formatMoney(plan.total_spent_in_allowance_categories)}</strong>
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
        </aside>
      </div>
    </section>
  );
}
