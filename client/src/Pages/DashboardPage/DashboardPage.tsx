import { useAuth } from '../../Contexts/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="dashboard-page">
      <h2>Dashboard</h2>
      {user && (
        <div className="user-info">
          <p>
            <strong>Name:</strong> {user.firstName} {user.lastName}
          </p>
          <p>
            <strong>Email:</strong> {user.email}
          </p>
          <p>
            <strong>Display Name:</strong> {user.displayName}
          </p>
          <p>
            <strong>Role:</strong> {user.role}
          </p>
        </div>
      )}
    </div>
  );
}
