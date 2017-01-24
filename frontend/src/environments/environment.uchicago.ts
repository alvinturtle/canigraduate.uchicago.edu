import { UniversityOfChicago } from 'institutions/uchicago';
import * as PouchDB from 'pouchdb';

export const environment = {
  production: true,
  backend: 'http://canigraduate.uchicago.edu',
  pouchConfig: {
    remotePath: 'https://kevmo314.cloudant.com/uchicago',
    localPath: 'uchicago'
  },
  firebaseConfig: {
    apiKey: 'AIzaSyCjBDyhwbXcp9kEIA2pMHLDGxmCM4Sn6Eg',
    authDomain: 'canigraduate-43286.firebaseapp.com',
    databaseURL: 'https://canigraduate-43286.firebaseio.com',
    storageBucket: 'canigraduate-43286.appspot.com',
    messagingSenderId: '916201625926'
  },
  hmr: false,
  // The cookie name used to store the username.
  cookieName: 'uchicago',
  institution: UniversityOfChicago
};
