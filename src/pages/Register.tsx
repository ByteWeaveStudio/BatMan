import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authErrorMessage } from '../lib/format';
import { Field } from '../components/primitives';
import { GoogleMark, Icon } from '../components/Icon';
import { BatMark } from '../components/BatMark';

function strengthOf(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) || /[^\w\s]/.test(password)) score++;
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score] };
}

export function Register() {
  const { signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'email' | 'google'>('');

  const strength = strengthOf(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy('email');
    try {
      await signUp(email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy('');
    }
  }

  async function onGoogle() {
    setError('');
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="auth">
      <div className="auth__panel">
        <div className="auth__brand">
          <span className="auth__mark">
            <BatMark size={36} />
          </span>
          <div>
            <h1 className="auth__title">Create your account</h1>
            <p className="auth__tagline">Your data is private to you and scoped by year.</p>
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

            <Field
              label="Password"
              htmlFor="password"
              required
              hint={password ? `${strength.label} — at least 6 characters` : 'At least 6 characters'}
            >
              <div className="password-wrap">
                <input
                  id="password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
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

            {password ? (
              <div className="strength" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={`strength__seg${i < strength.score ? ' is-on' : ''}`} />
                ))}
              </div>
            ) : null}

            <Field label="Confirm password" htmlFor="confirm" required>
              <input
                id="confirm"
                className={`input${mismatch ? ' input--invalid' : ''}`}
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>

            {error ? (
              <p className="auth__alert" role="alert">
                <Icon name="info" style={{ flex: 'none', width: 16, height: 16, marginTop: 2 }} />
                {error}
              </p>
            ) : null}

            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy !== ''}>
              {busy === 'email' ? 'Creating account…' : 'Create account'}
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
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
