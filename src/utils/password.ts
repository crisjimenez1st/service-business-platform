/** Contraseña segura: al menos 10 caracteres, con letras y números. Devuelve el mensaje de error o null. */
export function validatePassword(pw: string): string | null {
  if (pw.length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'La contraseña debe combinar letras y números.';
  return null;
}

export const PASSWORD_HINT = 'Mínimo 10 caracteres, con letras y números';
