export type AuthMode="signup"|"login";
export function authDestination(mode:AuthMode){return mode==="login"?"/path":"/generate";}
export interface AuthState{mode:AuthMode;showPassword:boolean}
export const initialAuthState:AuthState={mode:"signup",showPassword:false};
export type AuthAction={type:"set-mode";mode:AuthMode}|{type:"toggle-password"};
export function authReducer(state:AuthState,action:AuthAction):AuthState{return action.type==="set-mode"?{...state,mode:action.mode}:{...state,showPassword:!state.showPassword};}
