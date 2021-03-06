import { auth } from "../../models/firebase";

export const AuthenticationStatus = {
  UNAUTHENTICATED: "unauthenticated",
  EXPIRED: "expired",
  LOGGED_OUT: "logged out",
  REJECTED: "rejected",
  PENDING: "pending",
  AUTHENTICATED: "authenticated",
  EDUCATOR_AUTHENTICATED: "educator authenticated"
};

export const AuthenticationType = {
  STUDENT: "student",
  EDUCATOR: "educator",
  EDUCATOR_REGISTER: "educator register"
};

const DEFAULT_STATE = {
  username: "",
  password: "",
  token: null,
  status: AuthenticationStatus.UNAUTHENTICATED,
  message: "",
  data: {}
};

export default {
  namespaced: true,
  state: { ...DEFAULT_STATE },
  mutations: {
    update(state, params) {
      Object.assign(state, params);
    }
  },
  actions: {
    authenticate(context, data = {}) {
      context.commit("update", {
        ...data,
        type: AuthenticationType.STUDENT,
        status: AuthenticationStatus.PENDING,
        message: ""
      });
      const institution = context.rootGetters["institution/institution"];
      institution
        .getTranscript(context.state.username, context.state.password)
        .subscribe(
          response => {
            context.commit("update", {
              status: AuthenticationStatus.AUTHENTICATED,
              token: response.data.token,
              data: {
                displayName: response.data.data.displayName,
                email: response.data.data.email
              }
            });
            context.commit("transcript/update", response.data.transcript, {
              root: true
            });
          },
          error => {
            context.commit("update", {
              message: error.response
                ? error.response.data.error
                : error.message,
              status: AuthenticationStatus.REJECTED
            });
          }
        );
    },
    authenticateEducators(
      context,
      data: { username: string; password: string } = {
        username: null,
        password: null
      }
    ) {
      context.commit("update", {
        ...data,
        type: AuthenticationType.EDUCATOR,
        status: AuthenticationStatus.PENDING,
        message: ""
      });
      context.rootState.institution.endpoints
        .educatorSignIn(data.username, data.password)
        .subscribe(
          response => {
            context.commit("update", {
              status: AuthenticationStatus.EDUCATOR_AUTHENTICATED,
              message: response.data.success
            });
          },
          error => {
            context.commit("update", {
              message: error.response
                ? error.response.data.error
                : error.message,
              status: AuthenticationStatus.REJECTED
            });
          }
        );
    },
    createEducatorAccount(context, data = {}) {
      context.commit("update", {
        ...data,
        type: AuthenticationType.EDUCATOR_REGISTER,
        status: AuthenticationStatus.PENDING,
        message: ""
      });
      /*
      context.rootState.institution.endpoints
        .createEducatorAccount(data.username, data.password)
        .subscribe(
          response => {
            context.commit("update", {
              status: AuthenticationStatus.UNAUTHENTICATED,
              message: "A verification email has been sent."
            });
          },
          error => {
            context.commit("update", {
              message: error.response
                ? error.response.data.error
                : error.message,
              status: AuthenticationStatus.REJECTED
            });
          }
        );*/
    },
    reset(context, status = AuthenticationStatus.UNAUTHENTICATED) {
      if (context.state.status == AuthenticationStatus.AUTHENTICATED) {
        auth.signOut();
      }
      context.commit("update", { ...DEFAULT_STATE, status });
      context.commit("transcript/update", [], { root: true });
    }
  }
};
