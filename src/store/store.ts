import { applyMiddleware, combineReducers, compose, legacy_createStore as createStore } from "redux";
import { thunk } from "redux-thunk";
import { tableReducer } from "./reducer";

const rootReducer = combineReducers({
  table: tableReducer
});

export type RootState = ReturnType<typeof rootReducer>;

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
  }
}

const composeEnhancers =
  (typeof window !== "undefined" && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) || compose;

export const store = createStore(rootReducer, composeEnhancers(applyMiddleware(thunk)));

export type AppDispatch = typeof store.dispatch;
