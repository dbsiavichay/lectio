/** What the app knows about the signed-in user. Never includes the password hash. */
export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "member";
  color: string;
  timezone: string;
};
