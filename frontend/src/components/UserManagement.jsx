import { useEffect, useMemo, useRef, useState } from "react";

function initialCreateUserForm() {
  return {
    display_name: "",
    username: "",
    email: "",
    password: "",
    role: "member",
  };
}

function initialPasswordForm() {
  return {
    current_password: "",
    new_password: "",
  };
}

function initialProfileForm(user) {
  return {
    display_name: user?.display_name || "",
    username: user?.username || "",
    email: user?.email || "",
  };
}

function formatDateTime(value) {
  if (!value) {
    return "Never";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sessionLabel(session) {
  const userAgent = (session.user_agent || "").trim();
  if (!userAgent) {
    return "Unknown browser or device";
  }

  if (userAgent.length > 72) {
    return `${userAgent.slice(0, 72)}...`;
  }

  return userAgent;
}

function UserIdentity({ user, avatarUrl, compact = false }) {
  return (
    <div className={`user-identity ${compact ? "compact" : ""}`}>
      <div className="user-identity-badge">
        {avatarUrl ? (
          <img className="user-badge-avatar" src={avatarUrl} alt={`${user.display_name} avatar`} />
        ) : (
          <span className="user-badge-initials">{user.initials || "MB"}</span>
        )}
      </div>
      <div className="user-identity-copy">
        <strong>{user.display_name}</strong>
        <span>@{user.username}</span>
      </div>
    </div>
  );
}

export default function UserManagement({
  users,
  currentUser,
  currentUserAvatarUrl,
  sessions,
  onCreateUser,
  onUpdateProfile,
  onUploadAvatar,
  onDeleteAvatar,
  onUpdateUser,
  onResetUserPassword,
  onDeleteUser,
  onChangePassword,
  onLogoutCurrentSession,
  onLogoutAllSessions,
  onAfterLogoutAll,
}) {
  const isOwner = currentUser?.role === "owner";
  const avatarInputRef = useRef(null);
  const [createUserForm, setCreateUserForm] = useState(initialCreateUserForm);
  const [profileForm, setProfileForm] = useState(initialProfileForm(currentUser));
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingUserForm, setEditingUserForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setProfileForm(initialProfileForm(currentUser));
  }, [currentUser]);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((left, right) => {
        if (left.role !== right.role) {
          return left.role === "owner" ? -1 : 1;
        }
        return left.display_name.localeCompare(right.display_name);
      }),
    [users],
  );

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  async function withSubmit(action, successMessage) {
    setSubmitting(true);
    clearFeedback();

    try {
      await action();
      if (successMessage) {
        setMessage(successMessage);
      }
    } catch (submitError) {
      setError(submitError.message || "Unable to save changes.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    await withSubmit(async () => {
      await onCreateUser({
        display_name: createUserForm.display_name.trim(),
        username: createUserForm.username.trim(),
        email: createUserForm.email.trim() || null,
        password: createUserForm.password,
        role: createUserForm.role,
      });
      setCreateUserForm(initialCreateUserForm());
    }, "Household user added.");
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    await withSubmit(
      () =>
        onUpdateProfile({
          display_name: profileForm.display_name.trim(),
          username: profileForm.username.trim(),
          email: profileForm.email.trim() || null,
        }),
      "Profile details updated.",
    );
  }

  async function handleAvatarUpload(event) {
    const [file] = event.target.files || [];
    event.target.value = "";

    if (!file) {
      return;
    }

    await withSubmit(() => onUploadAvatar(file), "Profile avatar updated.");
  }

  async function handleRemoveAvatar() {
    if (!window.confirm("Remove the current profile avatar?")) {
      return;
    }

    await withSubmit(() => onDeleteAvatar(), "Profile avatar removed.");
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    await withSubmit(async () => {
      await onChangePassword(passwordForm);
      setPasswordForm(initialPasswordForm());
    }, "Password updated. Sign in again with the new password.");
  }

  async function handleLogoutCurrent() {
    const confirmed = window.confirm("Log out this current session now?");
    if (!confirmed) {
      return;
    }

    await withSubmit(async () => {
      await onLogoutCurrentSession();
    });
  }

  async function handleLogoutAll() {
    const confirmed = window.confirm(
      "Log out every active session for your account? You will need to sign in again everywhere.",
    );
    if (!confirmed) {
      return;
    }

    await withSubmit(async () => {
      await onLogoutAllSessions();
      onAfterLogoutAll();
    });
  }

  function startEditingUser(user) {
    setEditingUserId(user.id);
    setEditingUserForm({
      display_name: user.display_name,
      username: user.username,
      email: user.email || "",
      role: user.role,
      is_active: user.is_active,
    });
    clearFeedback();
  }

  function cancelEditingUser() {
    setEditingUserId(null);
    setEditingUserForm(null);
  }

  async function saveEditingUser(userId) {
    await withSubmit(async () => {
      await onUpdateUser(userId, {
        display_name: editingUserForm.display_name.trim(),
        username: editingUserForm.username.trim(),
        email: editingUserForm.email.trim() || null,
        role: editingUserForm.role,
        is_active: editingUserForm.is_active,
      });
      cancelEditingUser();
    }, "Household user updated.");
  }

  async function toggleUserActive(user) {
    const nextState = !user.is_active;
    const promptText = nextState
      ? `Re-enable ${user.display_name}'s account?`
      : `Disable ${user.display_name}'s account? They will not be able to sign in until re-enabled.`;

    if (!window.confirm(promptText)) {
      return;
    }

    await withSubmit(
      () =>
        onUpdateUser(user.id, {
          display_name: user.display_name,
          username: user.username,
          email: user.email,
          role: user.role,
          is_active: nextState,
        }),
      nextState ? "User re-enabled." : "User disabled.",
    );
  }

  async function handleResetUserPassword(user) {
    const newPassword = window.prompt(`Enter a new password for ${user.display_name}:`, "");
    if (!newPassword) {
      return;
    }

    await withSubmit(
      () => onResetUserPassword(user.id, { new_password: newPassword }),
      `Password reset for ${user.display_name}.`,
    );
  }

  async function handleDeleteUser(user) {
    const confirmed = window.confirm(
      `Permanently delete ${user.display_name}'s user account? Disabled accounts are usually safer than deletion.`,
    );
    if (!confirmed) {
      return;
    }

    await withSubmit(() => onDeleteUser(user.id), "Household user removed.");
  }

  return (
    <div className="ledger-stack">
      {error ? <div className="form-error form-error-inline">{error}</div> : null}
      {message ? <div className="banner">{message}</div> : null}

      <div className="household-grid">
        <section className="section-card section-card-sheet">
          <div className="section-title-row">
            <div>
              <h2>My Profile</h2>
              <p className="section-subtitle">
                Keep your account details current and choose whether to use an uploaded avatar or initials.
              </p>
            </div>
          </div>

          <div className="profile-card">
            <UserIdentity user={currentUser} avatarUrl={currentUserAvatarUrl} />
            <div className="profile-card-meta">
              <span className="table-pill">{currentUser.role === "owner" ? "Owner" : "Member"}</span>
              <span className="table-note">
                {currentUser.has_avatar
                  ? currentUser.avatar_name || "Custom avatar uploaded"
                  : "Using initials badge right now"}
              </span>
            </div>
          </div>

          <form className="sheet-entry-form" onSubmit={handleSaveProfile}>
            <div className="sheet-entry-grid profile-grid">
              <div className="field">
                <label htmlFor="profile-display-name">Display Name</label>
                <input
                  id="profile-display-name"
                  value={profileForm.display_name}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      display_name: event.target.value,
                    }))
                  }
                  maxLength={120}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="profile-username">Username</label>
                <input
                  id="profile-username"
                  value={profileForm.username}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  minLength={3}
                  maxLength={80}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="profile-email">Email</label>
                <input
                  id="profile-email"
                  type="email"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  maxLength={255}
                />
              </div>

              <div className="field">
                <label>Avatar</label>
                <div className="action-group">
                  <input
                    ref={avatarInputRef}
                    className="hidden-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                  />
                  <button
                    className="table-action-button"
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={submitting}
                  >
                    Upload Avatar
                  </button>
                  {currentUser.has_avatar ? (
                    <button
                      className="table-action-button table-action-button-danger"
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={submitting}
                    >
                      Remove Avatar
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="sheet-entry-actions">
                <button className="button" type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="section-card section-card-sheet">
          <div className="section-title-row">
            <div>
              <h2>Session Management</h2>
              <p className="section-subtitle">
                See where your account is signed in and shut down the current or every open session.
              </p>
            </div>
            <span className="section-count">{sessions.length}</span>
          </div>

          <div className="session-toolbar">
            <button
              className="table-action-button"
              type="button"
              onClick={handleLogoutCurrent}
              disabled={submitting}
            >
              Log Out Current Session
            </button>
            <button
              className="table-action-button table-action-button-danger"
              type="button"
              onClick={handleLogoutAll}
              disabled={submitting}
            >
              Log Out All Sessions
            </button>
          </div>

          <div className="session-list">
            {sessions.map((session) => (
              <div key={session.id} className={`session-card ${session.current ? "current" : ""}`}>
                <div className="session-card-main">
                  <div className="session-card-title-row">
                    <strong>{session.current ? "Current Session" : "Active Session"}</strong>
                    {session.current ? <span className="table-pill paid">This device</span> : null}
                  </div>
                  <div className="session-card-device">{sessionLabel(session)}</div>
                  <div className="session-card-meta">
                    <span>IP: {session.ip_address || "Unknown"}</span>
                    <span>Signed in: {formatDateTime(session.created_at)}</span>
                    <span>Last seen: {formatDateTime(session.last_seen_at)}</span>
                    <span>Expires: {formatDateTime(session.expires_at)}</span>
                  </div>
                </div>
              </div>
            ))}
            {!sessions.length ? (
              <div className="empty-state">No active sessions were returned for this account.</div>
            ) : null}
          </div>
        </section>
      </div>

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

      {isOwner ? (
        <>
          <section className="section-card section-card-sheet">
            <div className="section-title-row">
              <div>
                <h2>Add Household User</h2>
                <p className="section-subtitle">
                  Create another login for this household and choose whether it should be an owner or member.
                </p>
              </div>
            </div>

            <form className="sheet-entry-form" onSubmit={handleCreateUser}>
              <div className="sheet-entry-grid household-create-grid">
                <div className="field">
                  <label htmlFor="new-user-display-name">Display Name</label>
                  <input
                    id="new-user-display-name"
                    value={createUserForm.display_name}
                    onChange={(event) =>
                      setCreateUserForm((current) => ({
                        ...current,
                        display_name: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="new-user-username">Username</label>
                  <input
                    id="new-user-username"
                    value={createUserForm.username}
                    onChange={(event) =>
                      setCreateUserForm((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="new-user-email">Email</label>
                  <input
                    id="new-user-email"
                    type="email"
                    value={createUserForm.email}
                    onChange={(event) =>
                      setCreateUserForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="new-user-role">Role</label>
                  <select
                    id="new-user-role"
                    value={createUserForm.role}
                    onChange={(event) =>
                      setCreateUserForm((current) => ({
                        ...current,
                        role: event.target.value,
                      }))
                    }
                  >
                    <option value="member">Member</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="new-user-password">Password</label>
                  <input
                    id="new-user-password"
                    type="password"
                    value={createUserForm.password}
                    onChange={(event) =>
                      setCreateUserForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    minLength={8}
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
          </section>

          <section className="section-card section-card-sheet">
            <div className="section-title-row">
              <div>
                <h2>Household Users</h2>
                <p className="section-subtitle">
                  Edit household profile details, disable accounts, and reset another user&apos;s password.
                </p>
              </div>
              <span className="section-count">{sortedUsers.length}</span>
            </div>

            <div className="budget-table-wrap ledger-table-wrap">
              <table className="transaction-table ledger-table">
                <thead>
                  <tr>
                    <th className="row-number-column">#</th>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th className="actions-column">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((user, index) => {
                    const isEditing = editingUserId === user.id && editingUserForm;
                    const isSelf = currentUser?.id === user.id;

                    return (
                      <tr key={user.id}>
                        <td className="row-number-column">{index + 1}</td>
                        <td className="budget-table-category">
                          {isEditing ? (
                            <div className="inline-user-editor">
                              <input
                                className="inline-row-input"
                                value={editingUserForm.display_name}
                                onChange={(event) =>
                                  setEditingUserForm((current) => ({
                                    ...current,
                                    display_name: event.target.value,
                                  }))
                                }
                              />
                              <input
                                className="inline-row-input"
                                value={editingUserForm.username}
                                onChange={(event) =>
                                  setEditingUserForm((current) => ({
                                    ...current,
                                    username: event.target.value,
                                  }))
                                }
                              />
                            </div>
                          ) : (
                            <div className="table-user-cell">
                              <span className="user-badge-initials user-badge-initials-small">
                                {user.initials || "MB"}
                              </span>
                              <div className="table-user-copy">
                                <strong>
                                  {user.display_name}
                                  {isSelf ? " (You)" : ""}
                                </strong>
                                <span>@{user.username}</span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              className="inline-row-input"
                              type="email"
                              value={editingUserForm.email}
                              onChange={(event) =>
                                setEditingUserForm((current) => ({
                                  ...current,
                                  email: event.target.value,
                                }))
                              }
                            />
                          ) : (
                            user.email || <span className="table-note">No email saved</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <select
                              className="inline-row-select"
                              value={editingUserForm.role}
                              onChange={(event) =>
                                setEditingUserForm((current) => ({
                                  ...current,
                                  role: event.target.value,
                                }))
                              }
                              disabled={isSelf}
                            >
                              <option value="member">Member</option>
                              <option value="owner">Owner</option>
                            </select>
                          ) : (
                            <span className="table-pill">{user.role === "owner" ? "Owner" : "Member"}</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <select
                              className="inline-row-select"
                              value={editingUserForm.is_active ? "active" : "disabled"}
                              onChange={(event) =>
                                setEditingUserForm((current) => ({
                                  ...current,
                                  is_active: event.target.value === "active",
                                }))
                              }
                              disabled={isSelf}
                            >
                              <option value="active">Active</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          ) : (
                            <span className={`table-pill ${user.is_active ? "paid" : "unpaid"}`}>
                              {user.is_active ? "Active" : "Disabled"}
                            </span>
                          )}
                        </td>
                        <td>{formatDateTime(user.last_login_at)}</td>
                        <td className="actions-column">
                          <div className="action-group action-group-compact">
                            {isEditing ? (
                              <>
                                <button
                                  className="table-action-button"
                                  type="button"
                                  onClick={() => saveEditingUser(user.id)}
                                  disabled={submitting}
                                >
                                  Save
                                </button>
                                <button
                                  className="table-action-button"
                                  type="button"
                                  onClick={cancelEditingUser}
                                  disabled={submitting}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="table-action-button"
                                  type="button"
                                  onClick={() => startEditingUser(user)}
                                  disabled={submitting}
                                >
                                  Edit
                                </button>
                                {!isSelf ? (
                                  <button
                                    className="table-action-button"
                                    type="button"
                                    onClick={() => toggleUserActive(user)}
                                    disabled={submitting}
                                  >
                                    {user.is_active ? "Disable" : "Enable"}
                                  </button>
                                ) : null}
                                {!isSelf ? (
                                  <button
                                    className="table-action-button"
                                    type="button"
                                    onClick={() => handleResetUserPassword(user)}
                                    disabled={submitting}
                                  >
                                    Reset Password
                                  </button>
                                ) : null}
                                {!isSelf ? (
                                  <button
                                    className="table-action-button table-action-button-danger"
                                    type="button"
                                    onClick={() => handleDeleteUser(user)}
                                    disabled={submitting}
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="section-card section-card-sheet">
          <div className="section-title-row">
            <div>
              <h2>Household Access</h2>
              <p className="section-subtitle">
                Your account can update its own profile and session security. Only the household owner can manage other users.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
