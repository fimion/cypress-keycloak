/**
 * @typedef {module:cypress.Cypress} Cypress
 * @see {@link https://docs.cypress.io/api/api/table-of-contents.html}
 */

/**
 * @namespace KeycloakMethods
 * @type {object}
 */

/**
 * @module cypress-keycloak
 */

/**
 * Copy-pasted code from KC javascript client. It probably doesn't need to be
 * this complicated but I refused to spend time on figuring that out.
 * @private
 * @return {string} UUID string
 */
function createUUID() {
  const s = [];
  const hexDigits = "0123456789abcdef";
  for (let i = 0; i < 36; i++) {
    s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
  }
  s[14] = "4";
  s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);
  s[8] = s[13] = s[18] = s[23] = "-";
  return s.join("");
}

/**
 *
 * @export cypressKeycloak
 * @param {string} url - Url to Keycloak. Same as used for `new Keycloak({url})`
 * @param {string} realm - realm to use for Keycloak. Same as used for `new Keycloak({realm})`
 * @param {string} clientId - clientId for Keycloak. Same as used for `new Keycloak({clientId})`
 * @param {object} [options] - our configuration options
 * @param {string} [options.redirectUri=Cypress.config('baseUrl')] - the address for keycloak to redirect to.
 * @param {"standard"|"implicit"|"hybrid"} [options.flow="standard"] - the flow used for your keycloak instance. matches init option.
 * @param {"fragment"|"query"} [options.responseMode="fragment"] - how the token data will return. matches init option.
 * @param {string} [options.defaultUser=""] - the default username to log in with
 * @param {string} [options.defaultPassword=""] - the default password to log in with
 * @param {number} [options.additionalWait=0] - add wait time before login and logout if you need to delay things
 * @param {boolean} [options.registerCommands=true] - register commands automatically or not.
 * @param {boolean} [options.blockBeforeUnload=true] - keycloak does some stuff onbeforeunload that can mess with cypress. Turn this on or off.
 * @return {object.<KeycloakMethods>}
 */
function cypressKeycloak(url, realm, clientId, options) {
  let CURRENT_COOKIE = null;

  /**
   *
   * @param {Cypress.Response}response
   */
  function updateCookie(response) {
    if (response.headers["set-cookie"]) {
      CURRENT_COOKIE = response.headers["set-cookie"].join(";");
    }
  }

  function resetCookie() {
    CURRENT_COOKIE = null;
  }

  /**
   * @return {object}
   */
  function getCookieHeaders() {
    return CURRENT_COOKIE ? { Cookie: CURRENT_COOKIE } : {};
  }

  const OPTS = Object.assign(
    {},
    {
      redirectUri: Cypress.config("baseUrl"),
      flow: "standard",
      responseMode: "fragment",
      defaultUser: "",
      defaultPassword: "",
      registerCommands: true,
      blockBeforeUnload: true,
    },
    options
  );

  const FLOW_TYPES = {
    standard: "code",
    implicit: "id_token token",
    hybrid: "code id_token token",
  };

  function getFlow() {
    return FLOW_TYPES[OPTS.flow] || FLOW_TYPES.standard;
  }

  /**
   * generates the address to call for keycloak.
   *
   * @param endpoint
   * @return {string}
   */
  function openIDConnectUrl(endpoint = "") {
    return `${OPTS.url}/realms/${OPTS.realm}/protocol/openid-connect/${endpoint}`;
  }

  /**
   * @memberOf KeycloakMethods
   * @public
   * @param {string} [redirect_page=""] - the page we want to be redirected to
   * @param {string} [username=OPTS.defaultUser] - the username we want to log in with
   * @param {string} [password=OPTS.defaultPassword] - the password we want to login with
   * @return {Cypress.Chainable<Cypress.Response>}
   */
  function keycloakLogin(
    redirect_page = "",
    username = OPTS.defaultUser,
    password = OPTS.defaultPassword
  ) {
    /**
     * @type {Partial<Cypress.RequestOptions>}
     */
    const loginPageRequest = {
      url: openIDConnectUrl("auth"),
      qs: {
        client_id: OPTS.clientId,
        redirect_uri: OPTS.redirectUri + redirect_page,
        state: createUUID(),
        nonce: createUUID(),
        response_mode: OPTS.responseMode,
        response_type: getFlow(),
        scope: "openid",
      },
      followRedirect: false,
      headers: {
        ...getCookieHeaders(),
      },
    };

    /**
     *
     * @param {Cypress.Response} response
     * @return {Cypress.Chainable<Cypress.Response>}
     */
    function submitLoginForm(response) {
      // update our current auth cookie
      updateCookie(response);
      // If we are already logged in, bypass the POST
      if (response.redirectedToUrl) {
        return Promise.resolve(response);
      }
      const _el = document.createElement("html");
      _el.innerHTML = response.body;
      // This should be more strict depending on your login page template.
      const loginForm = _el.getElementsByTagName("form");
      const isAlreadyLoggedIn = !loginForm.length;
      if (isAlreadyLoggedIn) {
        return Promise.resolve(response);
      }
      return cy
        .request({
          form: true,
          method: "POST",
          url: loginForm[0].action,
          followRedirect: false,
          body: {
            username: username,
            password: password,
          },
          headers: {
            ...getCookieHeaders(),
          },
        })
        .then((response) => {
          updateCookie(response);
          return Promise.resolve(response);
        });
    }

    if (!CURRENT_COOKIE && OPTS.additionalWait) {
      cy.wait(OPTS.additionalWait);
    }

    return cy.request(loginPageRequest).then(submitLoginForm);
  }

  /**
   *
   * @memberOf KeycloakMethods
   * @public
   * @param {string} [page=''] - visits a keycloak page
   * @param {string} [username=OPTS.defaultUser] - change the username to login with
   * @param {string} [password=OPTS.defaultPassword] - change the password to log in with
   * @return {Cypress.Chainable<any>}
   */
  function keycloakVisit(
    page = "",
    username = OPTS.defaultUser,
    password = OPTS.defaultPassword
  ) {
    return keycloakLogin(page).then((response) => {
      return cy.visit(response.redirectedToUrl);
    });
  }

  /**
   * @memberOf KeycloakMethods
   * @public
   * @return {Cypress.Chainable<Cypress.Response>}
   */
  function keycloakLogout() {
    return cy
      .request({
        url: openIDConnectUrl(`logout`),
        qs: {
          redirect_uri: OPTS.redirectUri,
        },
        headers: {
          ...getCookieHeaders(),
        },
      })
      .then((response) => {
        resetCookie();
        return Promise.resolve(response);
      });
  }

  if (OPTS.registerCommands) {
    Cypress.Commands.add("keycloakLogin", keycloakLogin);
    Cypress.Commands.add("keycloakVisit", keycloakVisit);
    Cypress.Commands.add("keycloakLogout", keycloakLogout);
  }

  if (OPTS.blockBeforeUnload) {
    Cypress.on("window:before:load", function (win) {
      const original = win.EventTarget.prototype.addEventListener;

      win.EventTarget.prototype.addEventListener = function () {
        if (arguments && arguments[0] === "beforeunload") {
          return;
        }
        return original.apply(this, arguments);
      };

      Object.defineProperty(win, "onbeforeunload", {
        get: function () {},
        set: function () {},
      });
    });
  }

  return {
    keycloakLogin,
    keycloakLogout,
    keycloakVisit,
  };
}

export default cypressKeycloak;
