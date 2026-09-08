import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authErrorMessage } from '../lib/format';
import { Field } from '../components/primitives';
import { GoogleMark, Icon } from '../components/Icon';
import { BatMark } from '../components/BatMark';

export function Login() {
  const { signIn, signInWithGoogle, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<'' | 'email' | 'google'>('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy('email');
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy('');
    }
  }

  async function onGoogle() {
    setError('');
    setNotice('');
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy('');
    }
  }

  async function onReset() {
    const target = email.trim();
    if (!target) {
      setError('Enter your email address first, then tap “Forgot password”.');
      return;
    }
    setError('');
    try {
      await resetPassword(target);
      setNotice(`Password reset link sent to ${target}.`);
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  return (
    <div className="auth">
      <div className="auth__panel">
        <div className="auth__brand">
          <span className="auth__mark">
            <BatMark size={32} />
          </span>
          <div>
            <h1 className="auth__title">BatMan</h1>
            <p className="auth__tagline">Goals, habits, money and growth — one year-scoped workspace.</p>
          </div>
        </div>

        <div className="auth__card">
          <form className="stack" onSubmit={onSubmit} noValidate>
            <Field label="Email" htmlFor="email" required>
              <input
                id="email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </Field>

            <Field label="Password" htmlFor="password" required>
              <div className="password-wrap">
                <input
                  id="password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="icon-btn password-wrap__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                </button>
              </div>
            </Field>

            <div className="auth__link-row">
              <button type="button" className="link-btn" onClick={onReset}>
                Forgot password?
              </button>
            </div>

            {error ? (
              <p className="auth__alert" role="alert">
                <Icon name="info" style={{ flex: 'none', width: 16, height: 16, marginTop: 2 }} />
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="auth__alert auth__alert--ok" role="status">
                <Icon name="check" style={{ flex: 'none', width: 16, height: 16, marginTop: 2 }} />
                {notice}
              </p>
            ) : null}

            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy !== ''}>
              {busy === 'email' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="auth__divider" style={{ margin: 'var(--s-5) 0' }}>
            or
          </div>

          <button
            type="button"
            className="btn btn--secondary btn--lg btn--block"
            onClick={onGoogle}
            disabled={busy !== ''}
          >
            <GoogleMark />
            {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
          </button>
        </div>

        <p className="auth__foot">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
