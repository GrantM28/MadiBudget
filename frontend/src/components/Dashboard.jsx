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

  return (
    <section className="dashboard">
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
          <div className={`metric-value ${safeClass}`}>
            {formatMoney(dashboard.safe_to_spend_after_budgeted_categories)}
          </div>
          <div className="metric-label">Safe To Spend</div>
          <div className="metric-note">The cushion left after bills and full allowance budgets.</div>
        </article>
      </div>

      <div className="dashboard-lower">
        <article className="section-card">
          <div className="section-title-row">
            <div>
              <h2>Allowance Category Snapshot</h2>
              <p className="section-subtitle">
                Budget, spent, and remaining for {month}.
              </p>
            </div>
          </div>

          <div className="category-grid">
            {dashboard.remaining_per_category.map((category) => {
              const remainingClass =
                Number(category.remaining) < 0 ? "negative" : "positive";

              return (
                <div className="category-card" key={category.category_id}>
                  <div className="category-header">
                    <div className="category-name">{category.category_name}</div>
                    <div className={`category-remaining ${remainingClass}`}>
                      {formatMoney(category.remaining)}
                    </div>
                  </div>

                  <div className="category-stats">
                    <div>
                      <span className="category-stat-label">Budget</span>
                      <strong>{formatMoney(category.budget)}</strong>
                    </div>
                    <div>
                      <span className="category-stat-label">Spent</span>
                      <strong>{formatMoney(category.spent)}</strong>
                    </div>
                    <div>
                      <span className="category-stat-label">Remaining</span>
                      <strong>{formatMoney(category.remaining)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <aside className="section-card">
          <h2>Monthly Plan</h2>
          <p className="section-subtitle">
            A conservative view of what is truly available this month.
          </p>

          <div className="summary-list">
            <div className="summary-row">
              <div>
                <span className="summary-list-label">Actual Category Spend</span>
                <strong>{formatMoney(plan.total_spent_in_allowance_categories)}</strong>
              </div>
              <div>
                <span className="summary-list-label">Month</span>
                <strong>{plan.month}</strong>
              </div>
            </div>

            <div className="summary-row">
              <div>
                <span className="summary-list-label">Buffer After Bills</span>
                <strong>{formatMoney(plan.buffer_after_bills)}</strong>
              </div>
            </div>

            <div className="summary-row safe">
              <div>
                <span className="summary-list-label">Safe To Spend</span>
                <strong>
                  {formatMoney(plan.safe_to_spend_after_budgeted_categories)}
                </strong>
              </div>
            </div>

            <div className="summary-row warning">
              <div>
                <span className="summary-list-label">Buffer After Actual Spending</span>
                <strong>{formatMoney(plan.buffer_after_actual_spending)}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
