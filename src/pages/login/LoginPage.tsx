import './login.css';

export function LoginPage(): JSX.Element {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1>XPORY Governance</h1>
        <p>Login placeholder - conecte ao backend para autenticar.</p>
        <form>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="usuario@xpory.com" />

          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" placeholder="••••••••" />

          <button type="button">Entrar</button>
        </form>
      </div>
    </div>
  );
}
