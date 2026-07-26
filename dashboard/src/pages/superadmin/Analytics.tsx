export default function Analytics() {
  return (
    <div className="card">
      <h1 className="text-2xl font-bold mb-4">Platform Analytics</h1>
      <p className="text-gray-600">View detailed analytics and reports for the entire platform.</p>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold">Revenue Analytics</h3>
          <p className="text-sm text-gray-600 mt-2">Track platform revenue and growth</p>
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold">User Analytics</h3>
          <p className="text-sm text-gray-600 mt-2">Monitor merchant and device activity</p>
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold">License Analytics</h3>
          <p className="text-sm text-gray-600 mt-2">License usage and distribution</p>
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold">Payment Analytics</h3>
          <p className="text-sm text-gray-600 mt-2">Payment processing and settlement</p>
        </div>
      </div>
    </div>
  );
}
