const { useEffect, useState } = React;
const axios = window.axios;

axios.defaults.xsrfCookieName = "csrftoken";
axios.defaults.xsrfHeaderName = "X-CSRFToken";

const API_BASE = "http://127.0.0.1:8000/api";

function App() {
  // =========================================================
  // Authentication & View Mode ("login" | "register" | "reset")
  // =========================================================
  const [authView, setAuthView] = useState("login");
  const [activeTab, setActiveTab] = useState("page1");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("teo_tian_yu");
  const [password, setPassword] = useState("password123");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);

  // Register Form States
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  // Reset Password Form States
  const [resetUsername, setResetUsername] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");

  // =========================================================
  // Page 1 - Sovereign Data Vault
  // =========================================================
  const [selectedContext, setSelectedContext] = useState("professional");
  const [customContexts, setCustomContexts] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [contextAttributes, setContextAttributes] = useState([]);

  // Form states
  const [newKeyName, setNewKeyName] = useState("");

  const [attrKey, setAttrKey] = useState("");
  const [attrValue, setAttrValue] = useState("");
  const [attrPrivate, setAttrPrivate] = useState(false);

  // Edit Attribute state
  const [editingAttrId, setEditingAttrId] = useState(null);
  const [editAttrValue, setEditAttrValue] = useState("");
  const [editAttrPrivate, setEditAttrPrivate] = useState(false);

  // API Key Secret Visibility Map
  const [showKeySecrets, setShowKeySecrets] = useState({});
  
  // API Key Scope Management Modal State
  const [managingKey, setManagingKey] = useState(null);
  const [keyContextPermissions, setKeyContextPermissions] = useState({});

  const [newRealmKey, setNewRealmKey] = useState("");
  const [newRealmTitle, setNewRealmTitle] = useState("");

  // =========================================================
  // Page 2 - Developer Sandbox
  // =========================================================
  const [sandboxApiKey, setSandboxApiKey] = useState("sk_live_linkedin_998x");
  const [sandboxContext, setSandboxContext] = useState("professional");
  const [sandboxSource, setSandboxSource] = useState("LinkedIn");
  const [sandboxLanguage, setSandboxLanguage] = useState("en-US");
  const [discoveredPayload, setDiscoveredPayload] = useState(null);
  const [rawWireJson, setRawWireJson] = useState(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  const authHeaders = () => ({
    Authorization: `Bearer ${token}`,
  });

  useEffect(() => {
    if (token && isAuthenticated) {
      loadPage1Data();
    }
  }, [token, isAuthenticated, selectedContext]);

  const loadPage1Data = async () => {
    try {
      const headers = authHeaders();

      const [keysRes, logsRes, ctxRes, profileRes] = await Promise.all([
        axios.get(`${API_BASE}/key/list/`, { headers }),
        axios.get(`${API_BASE}/policy/audit-logs/`, { headers }),
        axios.get(`${API_BASE}/context/list/`, { headers }),
        axios.get(`${API_BASE}/profile/?context=${selectedContext}`, {
          headers: { ...headers, "X-Context": selectedContext }
        }).catch(() => null)
      ]);

      setApiKeys((keysRes && keysRes.data && keysRes.data.api_keys) || []);
      setAuditLogs((logsRes && logsRes.data && logsRes.data.audit_logs) || []);
      setCustomContexts((ctxRes && ctxRes.data && ctxRes.data.custom_contexts) || []);

      if (profileRes && profileRes.data && profileRes.data.profile_data) {
        setContextAttributes(profileRes.data.profile_data.dynamic_attributes || []);
      } else {
        setContextAttributes([]);
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      alert("Please enter username and password.");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE}/token/`, { username, password });
      setToken(res.data.access);
      setIsAuthenticated(true);
    } catch (err) {
      const errorMsg = err.response && err.response.data && err.response.data.detail
        ? err.response.data.detail
        : "Login failed: Invalid Credentials";
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regUsername || !regEmail || !regPassword) {
      alert("Please fill in all registration fields.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_BASE}/register/`, {
        username: regUsername,
        email: regEmail,
        password: regPassword
      });

      alert("Registration successful! Please sign in with your new credentials.");
      setUsername(regUsername);
      setPassword(regPassword);
      setAuthView("login");
    } catch (err) {
      const msg = err.response && err.response.data && err.response.data.error
        ? err.response.data.error
        : "Registration failed.";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUsername || !resetNewPassword) {
      alert("Please enter your username and new password.");
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_BASE}/password-reset/`, {
        username: resetUsername,
        new_password: resetNewPassword
      });

      alert("Password reset successful! You can now sign in.");
      setUsername(resetUsername);
      setPassword(resetNewPassword);
      setAuthView("login");
    } catch (err) {
      const msg = err.response && err.response.data && err.response.data.error
        ? err.response.data.error
        : "Password reset failed.";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken("");
    setIsAuthenticated(false);
    setActiveTab("page1");
    setDiscoveredPayload(null);
    setRawWireJson(null);
  };

  const handleIssueKey = async () => {
    if (!newKeyName.trim()) return alert("Enter client key name.");
    try {
      await axios.post(
        `${API_BASE}/key/create/`,
        { key_name: newKeyName.trim() },
        { headers: authHeaders() }
      );
      setNewKeyName("");
      await loadPage1Data();
      alert("API Key created! Status is Banned by default. Click 'Manage Scope' to enable specific contexts.");
    } catch (err) {
      alert("Failed to issue key.");
    }
  };

  const handleToggleBan = async (keyId, currentActive) => {
    try {
      await axios.post(
        `${API_BASE}/key/toggle-ban/`,
        { key_id: keyId, is_active: !currentActive },
        { headers: authHeaders() }
      );
      await loadPage1Data();
    } catch (err) {
      alert("Failed to update key status.");
    }
  };

  const toggleKeyVisibility = (keyId) => {
    setShowKeySecrets(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const handleOpenManageKey = async (keyObj) => {
    setManagingKey(keyObj);
    try {
    const res = await axios.get(`${API_BASE}/key/policies/?client_name=${encodeURIComponent(keyObj.key_name)}`, {
        headers: authHeaders()
      });
      const savedPolicies = (res.data && res.data.policies) || {};
      
      const initPerms = {
        professional: !!savedPolicies["professional"],
        personal: !!savedPolicies["personal"]
      };
      
      customContexts.forEach(c => {
        const cName = c.context_name || c.name;
        initPerms[cName] = !!savedPolicies[cName];
      });
      
      setKeyContextPermissions(initPerms);
    } catch (err) {
      console.error("Failed to fetch key policies:", err);
    }
  };

  const handleToggleContextPerm = async (contextName) => {
    const nextState = !keyContextPermissions[contextName];
    setKeyContextPermissions(prev => ({ ...prev, [contextName]: nextState }));

    try {
      await axios.post(
        `${API_BASE}/key/scope-policy/`,
        {
          client_name: managingKey.key_name,
          context_name: contextName,
          is_allowed: nextState
        },
        { headers: authHeaders() }
      );
      if (nextState && !managingKey.is_active) {
        await handleToggleBan(managingKey.id, false);
      }
    } catch (err) {
      alert("Failed to update context policy.");
    }
  };

  const handleSyncAttr = async () => {
    if (!attrKey.trim() || !attrValue.trim()) return alert("Fill in both attribute fields.");
    try {
      await axios.post(
        `${API_BASE}/attribute/add/`,
        {
          context_type: selectedContext,
          attribute_key: attrKey.trim(),
          attribute_value: attrValue.trim(),
          is_private: attrPrivate,
        },
        { headers: authHeaders() }
      );
      setAttrKey("");
      setAttrValue("");
      setAttrPrivate(false);
      await loadPage1Data();
      alert("Attribute synced successfully!");
    } catch (err) {
      alert("Sync failed.");
    }
  };

  const handleStartEditAttr = (attr) => {
    setEditingAttrId(attr.id || attr.attribute_key);
    setEditAttrValue(attr.attribute_value);
    setEditAttrPrivate(attr.is_private);
  };

  const handleSaveEditAttr = async (attrKeyName) => {
    try {
      await axios.post(
        `${API_BASE}/attribute/add/`,
        {
          context_type: selectedContext,
          attribute_key: attrKeyName,
          attribute_value: editAttrValue,
          is_private: editAttrPrivate,
        },
        { headers: authHeaders() }
      );
      setEditingAttrId(null);
      await loadPage1Data();
      alert("Attribute updated successfully!");
    } catch (err) {
      alert("Failed to update attribute.");
    }
  };

  const handleDeleteAttr = async (attrKeyName) => {
    if (!confirm(`Are you sure you want to delete attribute '${attrKeyName}'?`)) return;
    try {
      await axios.post(
        `${API_BASE}/attribute/add/`,
        {
          context_type: selectedContext,
          attribute_key: attrKeyName,
          attribute_value: "[DELETED]",
          is_private: true,
        },
        { headers: authHeaders() }
      );
      await loadPage1Data();
      alert("Attribute removed.");
    } catch (err) {
      alert("Failed to delete attribute.");
    }
  };

  const handleDeploySpace = async () => {
    if (!newRealmKey.trim() || !newRealmTitle.trim()) return alert("Fill in both space fields.");
    const contextName = newRealmKey.trim().toLowerCase().replace(/\s+/g, "_");
    try {
      await axios.post(
        `${API_BASE}/context/create/`,
        { context_name: contextName, display_title: newRealmTitle.trim() },
        { headers: authHeaders() }
      );
      setNewRealmKey("");
      setNewRealmTitle("");
      await loadPage1Data();
      alert("Category space deployed successfully.");
    } catch (err) {
      alert("Deploy space failed.");
    }
  };

  // GDPR Data Export (Article 20 Data Portability)
  const handleExportGDPRVault = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      owner: username,
      exported_at: new Date().toISOString(),
      active_context: selectedContext,
      attributes: contextAttributes,
      custom_realms: customContexts,
      keys: apiKeys
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Sovereign_Vault_${username}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const fireApiHandshake = async () => {
    if (!sandboxApiKey.trim()) return alert("Enter an API key.");
    try {
      setSandboxLoading(true);
      const res = await axios.get(`${API_BASE}/profile/`, {
        headers: {
          "X-API-KEY": sandboxApiKey.trim(),
          "X-Context": sandboxContext,
          "X-Client-Source": sandboxSource.trim() || "Unknown_ThirdParty",
          "Accept-Language": sandboxLanguage,
        },
      });
      setDiscoveredPayload(res.data);
      setRawWireJson(res.data);
      if (token) await loadPage1Data();
    } catch (err) {
      if (err.response) {
        setDiscoveredPayload(null);
        setRawWireJson(err.response.data);
      } else {
        setDiscoveredPayload(null);
        setRawWireJson({ error: "Unable to reach API server.", message: err.message });
      }
      if (token) await loadPage1Data();
    } finally {
      setSandboxLoading(false);
    }
  };

  const thirdPartyAuditLogs = auditLogs.filter(
    l => l.client_name !== "Owner_Dashboard" && l.client_name !== "System_Owner"
  );
  
  const totalAuditCount = thirdPartyAuditLogs.length;
  const allowedCount = thirdPartyAuditLogs.filter(l => l.access_status === "ALLOWED").length;
  const blockedCount = totalAuditCount - allowedCount;
  const interceptRate = totalAuditCount > 0 ? ((blockedCount / totalAuditCount) * 100).toFixed(1) : "0.0";

  const realmDistribution = thirdPartyAuditLogs.reduce((acc, log) => {
    const realm = log.requested_context || "unknown";
    acc[realm] = (acc[realm] || 0) + 1;
    return acc;
  }, {});

  if (!isAuthenticated) {
    return (
      <div style={styles.authWrapper}>
        <div style={styles.authCard}>
          <div style={styles.brandLogo}>🛡️ DynamicVault</div>
          <div style={styles.authSubtitle}>Sovereign Identity Management Gateway</div>

          <div style={styles.authTabSwitch}>
            <button
              style={{
                ...styles.authTabBtn,
                background: authView === "login" ? "#ea580c" : "#f1f5f9",
                color: authView === "login" ? "#fff" : "#64748b"
              }}
              onClick={() => setAuthView("login")}
            >
              Sign In
            </button>
            <button
              style={{
                ...styles.authTabBtn,
                background: authView === "register" ? "#ea580c" : "#f1f5f9",
                color: authView === "register" ? "#fff" : "#64748b"
              }}
              onClick={() => setAuthView("register")}
            >
              Register
            </button>
            <button
              style={{
                ...styles.authTabBtn,
                background: authView === "reset" ? "#ea580c" : "#f1f5f9",
                color: authView === "reset" ? "#fff" : "#64748b"
              }}
              onClick={() => setAuthView("reset")}
            >
              Reset
            </button>
          </div>

          {authView === "login" && (
            <div style={{ marginTop: 20 }}>
              <input
                style={styles.inputBox}
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
              />
              <input
                style={styles.inputBox}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
              />
              <button style={styles.btnPrimary} onClick={handleLogin} disabled={loading}>
                {loading ? "Authenticating..." : "Sign In to Dashboard"}
              </button>
            </div>
          )}

          {authView === "register" && (
            <div style={{ marginTop: 20 }}>
              <input
                style={styles.inputBox}
                type="text"
                placeholder="Choose Username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
              />
              <input
                style={styles.inputBox}
                type="email"
                placeholder="Email Address"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
              />
              <input
                style={styles.inputBox}
                type="password"
                placeholder="Password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
              />
              <input
                style={styles.inputBox}
                type="password"
                placeholder="Confirm Password"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
              />
              <button style={styles.btnPrimary} onClick={handleRegister} disabled={loading}>
                {loading ? "Registering..." : "Create Account"}
              </button>
            </div>
          )}

          {authView === "reset" && (
            <div style={{ marginTop: 20 }}>
              <input
                style={styles.inputBox}
                type="text"
                placeholder="Your Username"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
              />
              <input
                style={styles.inputBox}
                type="password"
                placeholder="New Password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
              />
              <button style={styles.btnPrimary} onClick={handleResetPassword} disabled={loading}>
                {loading ? "Updating..." : "Reset Password"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.dashboardContainer}>
      <aside style={styles.iconSidebar}>
        <div style={styles.brandIcon}>🛡️</div>
        <button
          style={{
            ...styles.navIconBtn,
            background: activeTab === "page1" ? "#fff7ed" : "transparent",
          }}
          onClick={() => setActiveTab("page1")}
          title="Sovereign Data Vault"
        >
          🔐
        </button>
        <button
          style={{
            ...styles.navIconBtn,
            background: activeTab === "page2" ? "#fff7ed" : "transparent",
          }}
          onClick={() => setActiveTab("page2")}
          title="Developer Sandbox"
        >
          🌐
        </button>
        <div style={{ flex: 1 }} />
        <button style={styles.navIconBtn} onClick={handleLogout} title="Logout">
          🚪
        </button>
      </aside>

      <div style={styles.mainWrapper}>
        <header style={styles.topHeader}>
          <div style={styles.tabSwitch}>
            <button
              style={{
                ...styles.tabBtn,
                background: activeTab === "page1" ? "#ffffff" : "transparent",
                color: activeTab === "page1" ? "#ea580c" : "#64748b",
              }}
              onClick={() => setActiveTab("page1")}
            >
              🔐 Data Vault
            </button>
            <button
              style={{
                ...styles.tabBtn,
                background: activeTab === "page2" ? "#ffffff" : "transparent",
                color: activeTab === "page2" ? "#ea580c" : "#64748b",
              }}
              onClick={() => setActiveTab("page2")}
            >
              🌐 Developer Sandbox
            </button>
          </div>

          <div style={styles.userArea}>
            <button style={styles.exportBtn} onClick={handleExportGDPRVault} title="GDPR Article 20">
              📥 Export Vault (JSON)
            </button>
            <span style={styles.userBadge}>{username} (Data Owner)</span>
            <button style={styles.logoutBtn} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <main style={styles.contentArea}>
          {activeTab === "page1" && (
            <div>
              <div style={styles.pageHeader}>
                <div>
                  <h1 style={styles.pageTitle}>🛡️ Sovereign Data Vault</h1>
                  <p style={styles.pageDescription}>
                    Manage your dynamic identity, contexts, attributes and delegated API access.
                  </p>
                </div>
                <div style={styles.liveBadge}>● SYSTEM ONLINE</div>
              </div>

              {/* Context Selector */}
              <div style={styles.card}>
                <div style={styles.cardTitle}>
                  <span>🎯 Target Realm & EAV</span>
                  <span style={styles.smallBadge}>{selectedContext}</span>
                </div>

                <div style={styles.contextSelector}>
                  <button
                    style={{
                      ...styles.contextBtn,
                      ...(selectedContext === "professional" ? styles.contextBtnActive : {}),
                    }}
                    onClick={() => setSelectedContext("professional")}
                  >
                    💼 Professional
                  </button>
                  <button
                    style={{
                      ...styles.contextBtn,
                      ...(selectedContext === "personal" ? styles.contextBtnActive : {}),
                    }}
                    onClick={() => setSelectedContext("personal")}
                  >
                    👤 Personal
                  </button>

                  {customContexts.map((ctx) => {
                    const contextName = ctx.context_name || ctx.name || ctx.key;
                    const displayTitle = ctx.display_title || ctx.title || contextName;
                    return (
                      <button
                        key={ctx.id || contextName}
                        style={{
                          ...styles.contextBtn,
                          ...(selectedContext === contextName ? styles.contextBtnActive : {}),
                        }}
                        onClick={() => setSelectedContext(contextName)}
                      >
                        📁 {displayTitle}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Context Attribute Management Section */}
              <div style={styles.card}>
                <div style={styles.cardTitle}>
                  <span>📋 Attributes in [{selectedContext}] Context</span>
                  <span style={styles.smallBadge}>{contextAttributes.length} Fields</span>
                </div>

                {contextAttributes.length === 0 ? (
                  <div style={styles.emptyState}>No attributes found for this context. Add one below.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={styles.dataTable}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Attribute Key</th>
                          <th style={styles.th}>Value</th>
                          <th style={styles.th}>Privacy</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contextAttributes.map((attr, idx) => {
                          const currentAttrId = attr.id || attr.attribute_key;
                          const isEditing = editingAttrId === currentAttrId;

                          return (
                            <tr key={currentAttrId || idx}>
                              <td style={styles.td}><b>{attr.attribute_key}</b></td>
                              <td style={styles.td}>
                                {isEditing ? (
                                  <input
                                    style={{ ...styles.inputBox, marginBottom: 0, padding: 4 }}
                                    value={editAttrValue}
                                    onChange={(e) => setEditAttrValue(e.target.value)}
                                  />
                                ) : (
                                  <span style={{ color: attr.is_private ? "#92400e" : "#166534" }}>
                                    {attr.attribute_value}
                                  </span>
                                )}
                              </td>
                              <td style={styles.td}>
                                {isEditing ? (
                                  <label style={{ fontSize: 11, display: "flex", gap: 4, alignItems: "center" }}>
                                    <input
                                      type="checkbox"
                                      checked={editAttrPrivate}
                                      onChange={(e) => setEditAttrPrivate(e.target.checked)}
                                    /> Private
                                  </label>
                                ) : (
                                  <span style={{ ...styles.badge, background: attr.is_private ? "#fef3c7" : "#dcfce7", color: attr.is_private ? "#92400e" : "#166534" }}>
                                    {attr.is_private ? "🔒 Private" : "🌐 Public"}
                                  </span>
                                )}
                              </td>
                              <td style={styles.td}>
                                {isEditing ? (
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button style={{ ...styles.btnAction, background: "#16a34a" }} onClick={() => handleSaveEditAttr(attr.attribute_key)}>Save</button>
                                    <button style={{ ...styles.btnAction, background: "#64748b" }} onClick={() => setEditingAttrId(null)}>Cancel</button>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button style={{ ...styles.btnAction, background: "#2563eb" }} onClick={() => handleStartEditAttr(attr)}>Edit</button>
                                    <button style={{ ...styles.btnAction, background: "#dc2626" }} onClick={() => handleDeleteAttr(attr.attribute_key)}>Delete</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Grid 2 Col: Deploy Space & Sync Attribute */}
              <div style={styles.grid2Col}>
                <div style={styles.card}>
                  <div style={styles.cardTitle}><span>🗂️ Deploy Category Space</span></div>
                  <input
                    style={styles.inputBox}
                    type="text"
                    placeholder="Context key e.g. gaming"
                    value={newRealmKey}
                    onChange={(e) => setNewRealmKey(e.target.value)}
                  />
                  <input
                    style={styles.inputBox}
                    type="text"
                    placeholder="Display title e.g. Gaming"
                    value={newRealmTitle}
                    onChange={(e) => setNewRealmTitle(e.target.value)}
                  />
                  <button style={styles.btnPrimary} onClick={handleDeploySpace}>
                    Deploy Category Space
                  </button>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardTitle}>
                    <span>🔄 Synchronize Dynamic Attribute</span>
                    <span style={styles.smallBadge}>{selectedContext}</span>
                  </div>
                  <input
                    style={styles.inputBox}
                    type="text"
                    placeholder="Attribute key"
                    value={attrKey}
                    onChange={(e) => setAttrKey(e.target.value)}
                  />
                  <input
                    style={styles.inputBox}
                    type="text"
                    placeholder="Attribute value"
                    value={attrValue}
                    onChange={(e) => setAttrValue(e.target.value)}
                  />
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={attrPrivate}
                      onChange={(e) => setAttrPrivate(e.target.checked)}
                    />
                    🔒 Hide attribute (Server Conceal)
                  </label>
                  <button style={styles.btnPrimary} onClick={handleSyncAttr}>
                    Synchronize Field
                  </button>
                </div>
              </div>

              {/* Delegated API Key Governance */}
              <div style={styles.card}>
                <div style={styles.cardTitle}><span>🔑 Delegated API Key Governance</span></div>

                <div style={styles.inlineForm}>
                  <input
                    style={{ ...styles.inputBox, marginBottom: 0, flex: 3 }}
                    type="text"
                    placeholder="Client App / Third-Party Name (e.g. LinkedIn, Discord)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                  <button style={styles.btnPrimarySmall} onClick={handleIssueKey}>
                    Issue Delegated Key
                  </button>
                </div>

                <div style={{ overflowX: "auto", marginTop: 20 }}>
                  <table style={styles.dataTable}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Client App Name</th>
                        <th style={styles.th}>API Key Secret (Third-Party View)</th>
                        <th style={styles.th}>Global Status</th>
                        <th style={styles.th}>Scope Permission</th>
                        <th style={styles.th}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeys.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ ...styles.td, textAlign: "center", color: "#94a3b8" }}>
                            No API keys issued. Create one above to grant third-party access.
                          </td>
                        </tr>
                      ) : (
                        apiKeys.map((k) => {
                          const isVisible = showKeySecrets[k.id];
                          const secretValue = k.api_key || k.key || `sk_live_${k.key_name.toLowerCase()}_token`;
                          const maskedSecret = "••••••••••••••••••••••••";

                          return (
                            <tr key={k.id || k.key_name}>
                              <td style={styles.td}><b>{k.key_name}</b></td>
                              <td style={styles.td}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                                    {isVisible ? secretValue : maskedSecret}
                                  </code>
                                  <button
                                    style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13 }}
                                    onClick={() => toggleKeyVisibility(k.id)}
                                  >
                                    {isVisible ? "🙈 Hide" : "👀 View"}
                                  </button>
                                </div>
                              </td>
                              <td style={styles.td}>
                                <span
                                  style={{
                                    ...styles.badge,
                                    background: k.is_active ? "#dcfce7" : "#fee2e2",
                                    color: k.is_active ? "#166534" : "#991b1b",
                                  }}
                                >
                                  {k.is_active ? "🟢 Active" : "🔴 Ban (Default)"}
                                </span>
                              </td>
                              <td style={styles.td}>
                                <button
                                  style={{ ...styles.btnAction, background: "#4f46e5" }}
                                  onClick={() => handleOpenManageKey(k)}
                                >
                                  ⚙️ Manage Scopes
                                </button>
                              </td>
                              <td style={styles.td}>
                                <button
                                  style={{
                                    ...styles.btnAction,
                                    background: k.is_active ? "#dc2626" : "#16a34a",
                                  }}
                                  onClick={() => handleToggleBan(k.id, k.is_active)}
                                >
                                  {k.is_active ? "Ban" : "Enable"}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal for Managing Context Permissions */}
              {managingKey && (
                <div style={styles.modalBackdrop}>
                  <div style={styles.modalCard}>
                    <div style={styles.cardTitle}>
                      <span>⚙️ Select Allowed Contexts for [{managingKey.key_name}]</span>
                      <button style={{ border: "none", background: "none", cursor: "pointer", fontWeight: "bold" }} onClick={() => setManagingKey(null)}>✕</button>
                    </div>

                    <p style={{ fontSize: 12, color: "#64748b", marginBottom: 15 }}>
                      Check contexts that this third-party is allowed to read. Unchecked contexts will be automatically BLOCKED.
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {["professional", "personal", ...customContexts.map(c => c.context_name || c.name)].map((cName) => (
                        <label key={cName} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer" }}>
                          <span style={{ fontWeight: "600", fontSize: 13, textTransform: "capitalize" }}>{cName}</span>
                          <input
                            type="checkbox"
                            checked={!!keyContextPermissions[cName]}
                            onChange={() => handleToggleContextPerm(cName)}
                          />
                        </label>
                      ))}
                    </div>

                    <button style={{ ...styles.btnPrimary, marginTop: 20 }} onClick={() => setManagingKey(null)}>
                      Done / Close
                    </button>
                  </div>
                </div>
              )}

              {/* Third-Party Access Analytics Dashboard */}
              <div style={styles.card}>
                <div style={styles.cardTitle}>
                  <span>📈 Security & Access Analytics Dashboard</span>
                  <span style={styles.smallBadge}>Third-Party Telemetry Only</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
                  <div style={styles.metricCard}>
                    <div style={styles.metricTitle}>Third-Party API Handshakes</div>
                    <div style={styles.metricValue}>{totalAuditCount}</div>
                  </div>
                  <div style={styles.metricCard}>
                    <div style={styles.metricTitle}>Access Intercept Rate</div>
                    <div style={{ ...styles.metricValue, color: parseFloat(interceptRate) > 0 ? "#dc2626" : "#16a34a" }}>
                      {interceptRate}%
                    </div>
                  </div>
                  <div style={styles.metricCard}>
                    <div style={styles.metricTitle}>Active Context Realms</div>
                    <div style={styles.metricValue}>{customContexts.length + 2}</div>
                  </div>
                </div>

                <div style={{ fontSize: 13, fontWeight: "700", marginBottom: 8, color: "#475569" }}>
                  Realm Traffic Distribution (Third-Party Calls):
                </div>
                {Object.keys(realmDistribution).length === 0 ? (
                  <div style={styles.emptyState}>No third-party audit telemetry recorded yet. Trigger handshakes in Developer Sandbox.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {Object.entries(realmDistribution).map(([realm, count]) => {
                      const percentage = Math.round((count / totalAuditCount) * 100);
                      return (
                        <div key={realm} style={{ background: "#f8fafc", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, fontWeight: "600" }}>
                            <span>Realm: {realm}</span>
                            <span>{count} requests ({percentage}%)</span>
                          </div>
                          <div style={{ width: "100%", background: "#e2e8f0", height: 8, borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${percentage}%`, background: "#ea580c", height: "100%" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Real-Time Security Audit Footprint */}
              <div style={styles.card}>
                <div style={styles.cardTitle}>
                  <span>🗃️ Real-Time Security Audit Footprint</span>
                  <span style={styles.smallBadge}>AccessHistory Logs</span>
                </div>

                <div style={styles.terminalCard}>
                  {auditLogs.length === 0 ? (
                    <div style={styles.terminalMuted}>// No audit events recorded yet.</div>
                  ) : (
                    auditLogs.map((log, index) => {
                      const isBlocked = log.access_status === "BLOCKED";
                      return (
                        <div key={log.id || `\({log.timestamp}-\){index}`} style={styles.logLine}>
                          <span style={styles.logTime}>[{log.timestamp || "unknown-time"}]</span>{" "}
                          <span
                            style={{
                              color: isBlocked ? "#ef4444" : "#22c55e",
                              fontWeight: "bold",
                              background: isBlocked ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
                              padding: "2px 6px",
                              borderRadius: "4px"
                            }}
                          >
                            {isBlocked ? "⛔ BLOCKED" : "🟢 ALLOWED"}
                          </span>{" "}
                          <span style={{ color: "#f8fafc" }}>
                            {"| Client: "}<b>{log.client_name || "Unknown"}</b>
                          </span>{" "}
                          <span style={{ color: "#cbd5e1" }}>
                            {"| Realm: "}<b>{log.requested_context || "Unknown"}</b>
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "page2" && (
            <div>
              <div style={styles.pageHeader}>
                <div>
                  <h1 style={styles.pageTitle}>🌐 Developer Sandbox</h1>
                  <p style={styles.pageDescription}>
                    Test delegated API access and inspect the dynamic profile payload returned by the gateway.
                  </p>
                </div>
                <div style={styles.liveBadge}>API TEST MODE</div>
              </div>

              <div style={styles.card}>
                <div style={styles.cardTitle}><span>🔌 API Gateway Handshake Tester</span></div>

                <div style={styles.grid4Col}>
                  <div>
                    <label style={styles.fieldLabel}>API Key</label>
                    <input
                      style={styles.inputBox}
                      type="text"
                      value={sandboxApiKey}
                      onChange={(e) => setSandboxApiKey(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Context</label>
                    <select
                      style={styles.selectBox}
                      value={sandboxContext}
                      onChange={(e) => setSandboxContext(e.target.value)}
                    >
                      <option value="professional">Professional</option>
                      <option value="personal">Personal</option>
                      {customContexts.map((ctx) => {
                        const name = ctx.context_name || ctx.name || ctx.key;
                        return (
                          <option key={ctx.id || name} value={name}>
                            {ctx.display_title || ctx.title || name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Client Source</label>
                    <input
                      style={styles.inputBox}
                      type="text"
                      value={sandboxSource}
                      onChange={(e) => setSandboxSource(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Content Negotiation</label>
                    <select
                      style={styles.selectBox}
                      value={sandboxLanguage}
                      onChange={(e) => setSandboxLanguage(e.target.value)}
                    >
                      <option value="en-US">en-US (English)</option>
                      <option value="zh-CN">zh-CN (Chinese)</option>
                      <option value="ms-MY">ms-MY (Malay)</option>
                    </select>
                  </div>
                </div>

                <button
                  style={{ ...styles.btnPrimary, marginTop: 10 }}
                  onClick={fireApiHandshake}
                  disabled={sandboxLoading}
                >
                  {sandboxLoading ? "Sending API Request..." : "💥 Fire API Request Handshake"}
                </button>
              </div>

              <div style={styles.grid2Col}>
                <div style={styles.card}>
                  <div style={styles.cardTitle}><span>🧬 Discovered Profile Payload</span></div>

                  {discoveredPayload && discoveredPayload.profile_data ? (
                    <div>
                      <div style={styles.profileHeader}>
                        <div style={styles.profileAvatar}>👤</div>
                        <div>
                          <div style={styles.profileName}>
                            {discoveredPayload.profile_data.display_name || username}
                          </div>
                          <div style={styles.profileContext}>
                            Category Face: {discoveredPayload.requested_context || sandboxContext}
                          </div>
                        </div>
                      </div>

                      <div style={styles.attributeList}>
                        {discoveredPayload.profile_data.dynamic_attributes &&
                        discoveredPayload.profile_data.dynamic_attributes.length > 0 ? (
                          discoveredPayload.profile_data.dynamic_attributes.map((a, i) => (
                            <div key={a.id || `\({a.attribute_key}-\){i}`} style={styles.attributeRow}>
                              <div style={styles.attributeKey}>{a.attribute_key}</div>
                              <div style={styles.attributeValue}>{a.attribute_value}</div>
                            </div>
                          ))
                        ) : (
                          <div style={styles.emptyState}>No dynamic attributes discovered.</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={styles.emptyState}>
                      No dynamic profile payload returned. Execute API request above.
                    </div>
                  )}
                </div>

                <div style={styles.card}>
                  <div style={styles.cardTitle}><span>💻 Wire-Level JSON Packet Inspector</span></div>
                  <pre style={styles.jsonInspector}>
                    {rawWireJson ? JSON.stringify(rawWireJson, null, 2) : "// Waiting for request..."}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = {
  authWrapper: {
    display: "flex",
    minHeight: "100vh",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
    padding: 20,
    boxSizing: "border-box",
  },
  authCard: {
    background: "rgba(255, 255, 255, 0.96)",
    padding: 40,
    borderRadius: 24,
    width: "100%",
    maxWidth: 400,
    textAlign: "center",
    boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
  },
  brandLogo: { fontSize: 26, fontWeight: "800", color: "#1e293b", marginBottom: 6 },
  authSubtitle: { color: "#64748b", fontSize: 13, lineHeight: 1.5, marginBottom: 15 },
  authTabSwitch: { display: "flex", background: "#f1f5f9", padding: 4, borderRadius: 8, gap: 4, marginBottom: 15 },
  authTabBtn: { flex: 1, padding: "7px 0", borderRadius: 6, fontSize: 12, fontWeight: "bold", border: "none", cursor: "pointer" },
  dashboardContainer: {
    display: "flex",
    height: "100vh",
    background: "#f8fafc",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: "#0f172a",
  },
  iconSidebar: {
    width: 64,
    background: "#ffffff",
    borderRight: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px 0",
    gap: 24,
    boxSizing: "border-box",
  },
  brandIcon: {
    width: 36,
    height: 36,
    background: "#ea580c",
    borderRadius: 10,
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
  },
  navIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    border: "none",
    background: "transparent",
    fontSize: 18,
  },
  mainWrapper: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 },
  topHeader: {
    minHeight: 60,
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    gap: 20,
  },
  tabSwitch: { display: "flex", background: "#f1f5f9", padding: 4, borderRadius: 8, gap: 4 },
  tabBtn: { padding: "7px 16px", borderRadius: 6, fontSize: 13, fontWeight: "bold", border: "none", cursor: "pointer" },
  userArea: { display: "flex", alignItems: "center", gap: 10 },
  userBadge: { fontSize: 13, fontWeight: "bold", background: "#e2e8f0", padding: "6px 12px", borderRadius: 20, whiteSpace: "nowrap" },
  exportBtn: { border: "none", background: "#e0f2fe", color: "#0369a1", padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: "bold", cursor: "pointer" },
  logoutBtn: { border: "none", background: "#fee2e2", color: "#b91c1c", padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: "bold", cursor: "pointer" },
  contentArea: { flex: 1, padding: 24, overflowY: "auto", boxSizing: "border-box" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 20 },
  pageTitle: { margin: 0, fontSize: 24, fontWeight: "800", color: "#0f172a" },
  pageDescription: { margin: "6px 0 0", color: "#64748b", fontSize: 13 },
  liveBadge: { background: "#dcfce7", color: "#166534", padding: "7px 10px", borderRadius: 7, fontSize: 10, fontWeight: "800", whiteSpace: "nowrap" },
  grid2Col: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20, marginBottom: 20 },
  grid3Col: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 },
  grid4Col: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 },
  card: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.02)", marginBottom: 20, boxSizing: "border-box" },
  cardTitle: { fontSize: 15, fontWeight: "bold", color: "#0f172a", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  smallBadge: { background: "#fff7ed", color: "#c2410c", padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: "bold" },
  metricCard: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, textAlign: "center" },
  metricTitle: { fontSize: 11, fontWeight: "700", color: "#64748b", marginBottom: 4, textTransform: "uppercase" },
  metricValue: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  inputBox: { width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, marginBottom: 10, boxSizing: "border-box", outline: "none", background: "#ffffff" },
  selectBox: { width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, boxSizing: "border-box", outline: "none", background: "#ffffff" },
  fieldLabel: { display: "block", fontSize: 11, fontWeight: "700", color: "#64748b", marginBottom: 6 },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#475569", marginBottom: 12, cursor: "pointer" },
  btnPrimary: { width: "100%", padding: 10, background: "#ea580c", color: "#ffffff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer" },
  btnPrimarySmall: { padding: "9px 14px", background: "#ea580c", color: "#ffffff", border: "none", borderRadius: 7, fontWeight: "bold", cursor: "pointer", whiteSpace: "nowrap" },
  btnAction: { padding: "5px 9px", fontSize: 11, fontWeight: "bold", color: "#ffffff", border: "none", borderRadius: 4, cursor: "pointer" },
  inlineForm: { display: "flex", gap: 10, alignItems: "center" },
  contextSelector: { display: "flex", flexWrap: "wrap", gap: 8 },
  contextBtn: { borderStyle: "solid", borderWidth: 1, borderColor: "#e2e8f0", background: "#f8fafc", color: "#475569", padding: "8px 12px", borderRadius: 7, fontSize: 12, fontWeight: "600", cursor: "pointer" },
  contextBtnActive: { background: "#fff7ed", borderColor: "#fb923c", color: "#c2410c" },
  dataTable: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: 10, background: "#f8fafc", color: "#64748b", borderBottom: "1px solid #e2e8f0", fontSize: 11, textTransform: "uppercase" },
  td: { padding: "12px 10px", borderBottom: "1px solid #f1f5f9", color: "#334155" },
  badge: { padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: "bold" },
  scopeBadge: { background: "#f1f5f9", color: "#475569", padding: "4px 7px", borderRadius: 5, fontSize: 11 },
  terminalCard: { background: "#0f172a", color: "#38bdf8", fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', padding: 16, borderRadius: 10, fontSize: 12, minHeight: 140, maxHeight: 220, overflowY: "auto", boxSizing: "border-box" },
  terminalMuted: { color: "#64748b" },
  logLine: { marginBottom: 7, lineHeight: 1.5 },
  logTime: { color: "#94a3b8" },
  profileHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 18 },
  profileAvatar: { width: 44, height: 44, borderRadius: 12, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 },
  profileName: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  profileContext: { marginTop: 3, fontSize: 11, color: "#64748b" },
  attributeList: { borderTop: "1px solid #e2e8f0" },
  attributeRow: { display: "grid", gridTemplateColumns: "minmax(120px, 0.7fr) 1.3fr", gap: 15, padding: "11px 0", borderBottom: "1px solid #f1f5f9" },
  attributeKey: { fontSize: 12, fontWeight: "700", color: "#475569" },
  attributeValue: { fontSize: 12, color: "#0f172a", wordBreak: "break-word" },
  emptyState: { padding: 25, textAlign: "center", color: "#94a3b8", fontSize: 13 },
  jsonInspector: { background: "#0f172a", color: "#38bdf8", borderRadius: 10, padding: 16, margin: 0, minHeight: 280, maxHeight: 450, overflow: "auto", fontSize: 12, lineHeight: 1.6, fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', boxSizing: "border-box", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  modalBackdrop: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
  modalCard: { background: "#ffffff", padding: 24, borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />
);