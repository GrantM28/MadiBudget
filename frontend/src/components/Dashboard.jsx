const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMoney(value) {
  return currency.format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number.isFinite(value) ? value.toFixed(0) : "0"}%`;
}

export default function Dashboard({ dashboard, plan, month }) {
  if (!dashboard || !plan) {
    return null;
  }

  const availableNow = Number(dashboard.available_to_spend_right_now);
  const plannedCushion = Number(dashboard.safe_to_spend_after_budgeted_categories);
  const overBudgetTotal = Number(dashboard.over_budget_total);
  const categoriesOverBudget = dashboard.categories_over_budget_count;
  const totalAllowances = Number(dashboard.total_allowances);
  const totalSpent = Number(dashboard.total_spent_in_allowance_categories);
  const budgetUsagePercent =
    totalAllowances > 0 ? Math.max(0, (totalSpent / totalAllowances) * 100) : 0;

      let statusLabel = "On track";
      let statusClass = "safe-positive";
      let statusMessage = "Current spending is still inside the monthly category plan.";

  if (availableNow < 0) {
    statusLabel = "Over budget now";
    statusClass = "safe-negative";
    statusMessage =
      "You have already spent beyond the money left after fixed expenses and remaining category allowances.";
  } else if (overBudgetTotal > 0) {
    statusLabel = "Categories over budget";
    statusClass = "safe-negative";
    statusMessage =
      "Some categories are already over budget, even if the overall month still has cash left.";
      } else if (plannedCushion < 0) {
    statusLabel = "Plan is short";
    statusClass = "safe-negative";
    statusMessage =
      "The full monthly plan does not fit inside income, even before more spending happens.";
  }

  const categoryRows = [...dashboard.remaining_per_category].sort((a, b) => {
    const aRemaining = Number(a.remaining);
    const bRemaining = Number(b.remaining);

    if (aRemaining < 0 && bRemaining >= 0) {
      return -1;
    }
    if (aRemaining >= 0 && bRemaining < 0) {
      return 1;
    }

    return aRemaining - bRemaining;
  });

  const overspentCategories = categoryRows
    .filter((category) => Number(category.remaining) < 0)
    .sort((a, b) => Number(a.remaining) - Number(b.remaining));

  const watchCategories = categoryRows
    .filter((category) => {
      const budget = Number(category.budget);
      const spent = Number(category.spent);
      const remaining = Number(category.remaining);
      return budget > 0 && remaining >= 0 && spent / budget >= 0.85;
    })
    .sort((a, b) => Number(b.spent) / Number(b.budget) - Number(a.spent) / Number(a.budget));

  const biggestOverrun = overspentCategories[0] || null;
  const topSpendCategory =
    [...categoryRows].sort((a, b) => Number(b.spent) - Number(a.spent))[0] || null;
  const budgetUsageClass =
    budgetUsagePercent > 100 ? "progress-fill-danger" : budgetUsagePercent >= 85 ? "progress-fill-warning" : "progress-fill-safe";

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <div>
          <p className="section-kicker">Overview</p>
          <h2 className="dashboard-title">Budget snapshot for {month}</h2>
          <p className="section-subtitle">
            The dashboard now separates planning cushion from what is actually safe to spend after
            current category overspending.
          </p>
        </div>

        <div className={`safe-status-chip ${statusClass}`}>
          <span className="safe-status-label">Status</span>
          <strong>{statusLabel}</strong>
        </div>
      </div>

      <section className={`dashboard-alert ${statusClass}`}>
        <div className="dashboard-alert-main">
          <span className="dashboard-alert-label">Actually Available Right Now</span>
          <strong className="dashboard-alert-value">
            {formatMoney(dashboard.available_to_spend_right_now)}
          </strong>
        </div>
        <div className="dashboard-alert-copy">
          <p>{statusMessage}</p>
          <p>
            Overspent categories: <strong>{categoriesOverBudget}</strong> | Over budget by{" "}
            <strong>{formatMoney(dashboard.over_budget_total)}</strong>
          </p>
        </div>
      </section>

      <section className="dashboard-priority-grid">
        <article className="section-card dashboard-priority-card">
          <div className="section-title-row">
            <div>
              <h2>Budget Usage</h2>
              <p className="section-subtitle">
                How much of the total category plan is already gone this month.
              </p>
            </div>
          </div>

          <div className="progress-metric-head">
            <strong>{formatMoney(dashboard.total_spent_in_allowance_categories)}</strong>
            <span>{formatPercent(budgetUsagePercent)} used</span>
          </div>
          <div className="progress-track">
            <div
              className={`progress-fill ${budgetUsageClass}`}
              style={{ width: `${Math.min(budgetUsagePercent, 100)}%` }}
            />
          </div>
          <p className="helper-text dashboard-inline-note">
            Budgeted categories total {formatMoney(dashboard.total_allowances)} for the month.
          </p>
        </article>

        <article className="section-card dashboard-priority-card">
          <div className="section-title-row">
            <div>
              <h2>Biggest Problem</h2>
              <p className="section-subtitle">
                The category currently doing the most damage.
              </p>
            </div>
          </div>

          {biggestOverrun ? (
            <div className="priority-callout priority-callout-danger">
              <strong>{biggestOverrun.category_name}</strong>
              <span>Over by {formatMoney(Math.abs(Number(biggestOverrun.remaining)))}</span>
            </div>
          ) : (
            <div className="priority-callout">
              <strong>No category is over budget right now.</strong>
              <span>The current month is still inside category limits.</span>
            </div>
          )}

          {topSpendCategory ? (
            <p className="helper-text dashboard-inline-note">
              Largest total spend so far: <strong>{topSpendCategory.category_name}</strong> at{" "}
              <strong>{formatMoney(topSpendCategory.spent)}</strong>.
            </p>
          ) : null}
        </article>

        <article className="section-card dashboard-priority-card">
          <div className="section-title-row">
            <div>
              <h2>Watch List</h2>
              <p className="section-subtitle">
                Categories that are almost out of room even if they are not over yet.
              </p>
            </div>
          </div>

          {watchCategories.length > 0 ? (
            <div className="insight-list">
              {watchCategories.slice(0, 3).map((category) => (
                <div key={category.category_id} className="insight-list-row">
                  <div>
                    <strong>{category.category_name}</strong>
                    <span>
                      {formatMoney(category.remaining)} left of {formatMoney(category.budget)}
                    </span>
                  </div>
                  <strong>{formatPercent((Number(category.spent) / Number(category.budget)) * 100)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="priority-callout">
              <strong>No categories on the edge.</strong>
              <span>Nothing is sitting at 85% or more of budget right now.</span>
            </div>
          )}
        </article>
      </section>

      <div className="metrics-grid metrics-grid-dashboard">
        <article className="metric-card">
          <div className="metric-label">Monthly Income</div>
          <div className="metric-value">{formatMoney(dashboard.monthly_income)}</div>
          <div className="metric-note">Recurring income plus extra income recorded this month.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Total Fixed Expenses</div>
          <div className="metric-value">{formatMoney(dashboard.total_bills)}</div>
          <div className="metric-note">Required fixed monthly obligations for the month.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Budgeted Categories</div>
          <div className="metric-value">{formatMoney(dashboard.total_allowances)}</div>
          <div className="metric-note">The full monthly category plan.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Net Category Spend</div>
          <div className="metric-value">
            {formatMoney(dashboard.total_spent_in_allowance_categories)}
          </div>
          <div className="metric-note">Expenses minus refunds and money back into categories.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Still Reserved</div>
          <div className="metric-value">
            {formatMoney(dashboard.remaining_budget_to_reserve_total)}
          </div>
          <div className="metric-note">Category budget money you still need to protect this month.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Over Budget By</div>
          <div className={`metric-value ${overBudgetTotal > 0 ? "safe-negative" : ""}`}>
            {formatMoney(dashboard.over_budget_total)}
          </div>
          <div className="metric-note">How far current overspending has already blown past category budgets.</div>
        </article>

        <article className="metric-card">
          <div className="metric-label">Planned Cushion</div>
          <div
            className={`metric-value ${
              plannedCushion >= 0 ? "safe-positive" : "safe-negative"
            }`}
          >
            {formatMoney(dashboard.safe_to_spend_after_budgeted_categories)}
          </div>
          <div className="metric-note">
            This is the plan-only cushion if every category stayed on budget.
          </div>
        </article>

        <article className="metric-card metric-card-critical">
          <div className="metric-label">Actual Available Now</div>
          <div className={`metric-value ${availableNow >= 0 ? "safe-positive" : "safe-negative"}`}>
            {formatMoney(dashboard.available_to_spend_right_now)}
          </div>
          <div className="metric-note">
            This is the number to trust before spending anything else.
          </div>
        </article>
      </div>

      <div className="dashboard-lower">
        <article className="section-card">
          <div className="section-title-row">
            <div>
              <h2>Category Balances</h2>
              <p className="section-subtitle">
                Overspent categories are shown first so the danger spots surface immediately.
              </p>
            </div>
          </div>

          {categoryRows.length === 0 ? (
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
                  {categoryRows.map((category) => {
                    const remainingClass =
                      Number(category.remaining) < 0 ? "negative" : "positive";

                    return (
                      <tr
                        key={category.category_id}
                        className={
                          Number(category.remaining) < 0 ? "budget-table-row-danger" : ""
                        }
                      >
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

        <aside className="section-card dashboard-side-stack">
          <div className="section-title-row">
            <div>
              <h2>Reality Check</h2>
              <p className="section-subtitle">
                A sharper view of what is planned, what is already gone, and what is still safe.
              </p>
            </div>
          </div>

          <div className="summary-stack">
            <div className="summary-tile">
              <span className="summary-list-label">Buffer After Fixed Expenses</span>
              <strong>{formatMoney(plan.buffer_after_bills)}</strong>
            </div>

            <div className="summary-tile">
              <span className="summary-list-label">Actual Category Spend</span>
              <strong>{formatMoney(plan.total_spent_in_allowance_categories)}</strong>
            </div>

            <div className="summary-tile">
              <span className="summary-list-label">Still Reserved For Budgets</span>
              <strong>{formatMoney(plan.remaining_budget_to_reserve_total)}</strong>
            </div>

            <div className="summary-tile summary-tile-warning">
              <span className="summary-list-label">Over Budget Damage</span>
              <strong>{formatMoney(plan.over_budget_total)}</strong>
            </div>

            <div className="summary-tile">
              <span className="summary-list-label">Planned Cushion</span>
              <strong>{formatMoney(plan.safe_to_spend_after_budgeted_categories)}</strong>
            </div>

            <div className="summary-tile summary-tile-critical">
              <span className="summary-list-label">Actually Safe Right Now</span>
              <strong>{formatMoney(plan.available_to_spend_right_now)}</strong>
            </div>
          </div>

          <div className="section-divider" />

          <div className="section-title-row section-title-row-tight">
            <div>
              <h2>Immediate Attention</h2>
              <p className="section-subtitle">
                The worst over-budget categories right now.
              </p>
            </div>
          </div>

          {overspentCategories.length > 0 ? (
            <div className="insight-list">
              {overspentCategories.slice(0, 4).map((category) => (
                <div key={category.category_id} className="insight-list-row insight-list-row-danger">
                  <div>
                    <strong>{category.category_name}</strong>
                    <span>Spent {formatMoney(category.spent)} against {formatMoney(category.budget)}</span>
                  </div>
                  <strong>{formatMoney(Math.abs(Number(category.remaining)))}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">Nothing is currently over budget.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
