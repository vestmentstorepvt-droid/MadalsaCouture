// @ts-nocheck — ported from the Express backend (helpers/passwordHelper.js); logic unchanged.


const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const isStrongPassword = (password) => passwordPolicy.test(password);

const __exports: any = { isStrongPassword, passwordPolicy };

export default __exports;
