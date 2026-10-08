// alasql's typings import "xlsx", which alasql does not install
declare module "xlsx" {
  export type WorkBook = unknown;
}
