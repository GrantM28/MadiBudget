const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMoney(value) {
  return currency.format(Number(value || 0));
}

export default function TransactionList({ transactions, month }) {
  return (
    <section className="section-card section-card-sheet">
      <div className="section-title-row">
        <div>
          <h2>Transaction Register</h2>
          <p className="section-subtitle">Worksheet view of all spending recorded for {month}.</p>
        </div>
        <span className="section-count">{transactions.length}</span>
      </div>

      {transactions.length === 0 ? (
        <p className="empty-state">No transactions recorded for this month yet.</p>
      ) : (
        <div className="budget-table-wrap ledger-table-wrap">
          <table className="transaction-table ledger-table">
            <thead>
              <tr>
                <th className="row-number-column">#</th>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction, index) => (
                <tr key={transaction.id}>
                  <td className="row-number-column">{index + 1}</td>
                  <td>{transaction.date}</td>
                  <td className="budget-table-category">{transaction.description}</td>
                  <td>{transaction.category_name}</td>
                  <td>{formatMoney(transaction.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
