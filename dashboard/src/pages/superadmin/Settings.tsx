export default function Settings() {
  return (
    <div className="card">
      <h1 className="text-2xl font-bold mb-4">Platform Settings</h1>
      <p className="text-gray-600">Configure platform-wide settings and preferences.</p>
      <div className="mt-6 space-y-4">
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold">Subscription Plans</h3>
          <p className="text-sm text-gray-600 mt-2">Manage subscription tiers and pricing</p>
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold">Payment Settings</h3>
          <p className="text-sm text-gray-600 mt-2">Configure payment processing and settlement</p>
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold">Email Templates</h3>
          <p className="text-sm text-gray-600 mt-2">Customize email notifications</p>
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold">System Configuration</h3>
          <p className="text-sm text-gray-600 mt-2">API keys and system settings</p>
        </div>
      </div>
    </div>
  );
}
