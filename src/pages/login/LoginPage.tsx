import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/auth/useAuth';
import { api } from '../../services/api';
import './login.css';

type LoginResponse = {
  accessToken: string;
  expiresIn: number;
};

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        email,
        password,
      });
      login(response.data.accessToken);
      navigate('/app/dashboard');
    } catch (err) {
      void err;
      setError('Falha ao autenticar. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>XPORY Governance</h1>
        <p>Entre com sua conta corporativa para acessar o painel.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="usuario@xpory.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && <span className="error">{error}</span>}

          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
