import { useState } from "react";

const initialUserForm = {
  username: "",
  password: "",
};

const initialPasswordForm = {
  current_password: "",
  new_password: "",
};

export default function UserManagement({
  users,
  currentUser,
  onCreateUser,
  onDeleteUser,
  onChangePassword,
  onLogoutAllSessions,
  onAfterLogoutAll,
}) {
  const [userForm, setUserForm] = useState(initialUserForm);
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleAddUser(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await onCreateUser(userForm);
      setUserForm(initialUserForm);
      setMessage("Household user added.");
    } catch (submitError) {
      setError(submitError.message || "Unable to add user.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await onChangePassword(passwordForm);
      setPasswordForm(initialPasswordForm);
      setMessage("Password updated. Sign in again with the new password.");
    } catch (submitError) {
      setError(submitError.message || "Unable to change password.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteUser(user) {
    const confirmed = window.confirm(`Remove user "${user.username}" from this household?`);
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await onDeleteUser(user.id);
      setMessage("Household user removed.");
    } catch (submitError) {
      setError(submitError.message || "Unable to remove user.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogoutAll() {
    const confirmed = window.confirm(
      "Log out every active session for your user account? You will need to sign in again everywhere.",
    );
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await onLogoutAllSessions();
      onAfterLogoutAll();
    } catch (submitError) {
      setError(submitError.message || "Unable to log out all sessions.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ledger-stack">
      {error ? <div className="form-error form-error-inline">{error}</div> : null}
      {message ? <div className="banner">{message}</div> : null}

      <section className="section-card section-card-sheet">
        <div className="section-title-row">
          <div>
            <h2>Household Users</h2>
            <p className="section-subtitle">
              Manage who can sign in to this self-hosted budget.
            </p>
          </div>
          <span className="section-count">{users.length}</span>
        </div>

        <form className="sheet-entry-form" onSubmit={handleAddUser}>
          <div className="sheet-entry-grid sheet-entry-grid-income">
            <div className="field">
              <label htmlFor="new-user-username">Username</label>
              <input
                id="new-user-username"
                value={userForm.username}
                onChange={(event) =>
                  setUserForm((current) => ({ ...current, username: event.target.value }))
                }
                required
              />
            </div>

            <div className="field">
              <label htmlFor="new-user-password">Password</label>
              <input
                id="new-user-password"
                type="password"
                value={userForm.password}
                onChange={(event) =>
                  setUserForm((current) => ({ ...current, password: event.target.value }))
                }
                required
              />
            </div>

            <div className="sheet-entry-actions">
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Add User"}
              </button>
            </div>
          </div>
        </form>

        <div className="budget-table-wrap ledger-table-wrap">
          <table className="transaction-table ledger-table">
            <thead>
              <tr>
                <th className="row-number-column">#</th>
                <th>Username</th>
                <th>Created</th>
                <th>Status</th>
                <th className="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user.id}>
                  <td className="row-number-column">{index + 1}</td>
                  <td className="budget-table-category">
                    {user.username}
                    {currentUser?.id === user.id ? " (You)" : ""}
                  </td>
                  <td>{user.created_at ? String(user.created_at).slice(0, 10) : "Unknown"}</td>
                  <td>{user.is_active ? "Active" : "Inactive"}</td>
                  <td className="actions-column">
                    {currentUser?.id === user.id ? (
                      <span className="table-note">Current account</span>
                    ) : (
                      <button
                        className="table-action-button table-action-button-danger"
                        type="button"
                        onClick={() => handleDeleteUser(user)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-card section-card-sheet">
        <div className="section-title-row">
          <div>
            <h2>Change Password</h2>
            <p className="section-subtitle">Update your own sign-in password.</p>
          </div>
        </div>

        <form className="sheet-entry-form" onSubmit={handleChangePassword}>
          <div className="sheet-entry-grid sheet-entry-grid-income">
            <div className="field">
              <label htmlFor="current-password">Current Password</label>
              <input
                id="current-password"
                type="password"
                value={passwordForm.current_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    current_password: event.target.value,
                  }))
                }
                required
              />
            </div>

            <div className="field">
              <label htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                value={passwordForm.new_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    new_password: event.target.value,
                  }))
                }
                required
              />
            </div>

            <div className="sheet-entry-actions">
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Change Password"}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="section-card section-card-sheet">
        <div className="section-title-row">
          <div>
            <h2>Session Control</h2>
            <p className="section-subtitle">
              Force every open session for your current login to sign in again.
            </p>
          </div>
        </div>

        <button className="button button-secondary" type="button" onClick={handleLogoutAll}>
          Log Out All Sessions
        </button>
      </section>
    </div>
  );
}
