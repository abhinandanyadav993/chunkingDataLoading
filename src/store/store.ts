import { applyMiddleware, combineReducers, compose, legacy_createStore as createStore } from "redux";
import { createEpicMiddleware } from "redux-observable";
import { tableReducer } from "./reducer";
import { rootEpic } from "./epics";
import type { TableAction } from "./actions";

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

const epicMiddleware = createEpicMiddleware<TableAction, TableAction, RootState>();

export const store = createStore(rootReducer, composeEnhancers(applyMiddleware(epicMiddleware)));
epicMiddleware.run(rootEpic);

export type AppDispatch = typeof store.dispatch;
