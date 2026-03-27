const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMoney(value) {
  return currency.format(Number(value || 0));
}

export default function TransactionList({ transactions, month }) {
  return (
    <section className="section-card">
      <div className="section-title-row">
        <div>
          <h2>Transaction List</h2>
          <p className="section-subtitle">Showing transactions for {month}.</p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <p className="empty-state">No transactions recorded for this month yet.</p>
      ) : (
        <table className="transaction-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>{transaction.date}</td>
                <td>{transaction.description}</td>
                <td>{transaction.category_name}</td>
                <td>{formatMoney(transaction.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
