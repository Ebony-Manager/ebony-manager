/** La clave pública VAPID puede viajar en el cliente; la privada vive solo en Vercel. */
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BOcWaBKmqRy4ixCKiq1Tww-NMKhJ98kuMmesEdBjUYQSYwgKzwuC9SZrUGJqepMDDTdZIOlJNyb9dsS0y5ZpgIk";
