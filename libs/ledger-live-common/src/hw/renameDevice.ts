import { EMPTY, Subject, catchError, from } from "rxjs";
import { delay } from "rxjs/operators";
// import { Observable, Subject, concat, defer, from, of } from "rxjs";
// import { catchError, concatMap, map, retry, switchMap } from "rxjs/operators";
// import { retryWhileErrors, withDevice } from "./deviceAccess";
import { withDevice } from "./deviceAccess";
import editDeviceName from "./editDeviceName";
import getAppAndVersion from "./getAppAndVersion";
import { isDashboardName } from "./isDashboardName";
// import attemptToQuitApp from "./attemptToQuitApp";
import quitApp from "./quitApp";
import { DisconnectedDevice } from "@ledgerhq/errors";
import Transport from "@ledgerhq/hw-transport";

export type RenameDeviceEvent =
  | { type: "attemptToQuitApp" }
  | { type: "onDashboard" }
  | {
      type: "unresponsiveDevice";
    }
  | {
      type: "permission-requested";
    }
  | {
      type: "device-renamed";
      name: string;
    };

export type RenameDeviceRequest = { name: string };
export type Input = {
  deviceId: string;
  request: RenameDeviceRequest;
  wired: boolean;
};

export default function renameDevice({
  deviceId,
  request, // wired,
}: Input): Subject<RenameDeviceEvent> {
  const { name } = request;
  const subject = new Subject<RenameDeviceEvent>();

  const innerFn = async (transport: Transport) => {
    try {
      const appAndVersion = await getAppAndVersion(transport);
      if (!isDashboardName(appAndVersion.name)) {
        subject.next({ type: "attemptToQuitApp" });
        await quitApp(transport);
        throw new Error("not on dashboard");
      }

      subject.next({ type: "onDashboard" });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "not on dashboard") {
        throw error;
      }

      subject.error({ type: "error", error });
      throw error;
    }

    try {
      subject.next({ type: "permission-requested" });
      await editDeviceName(transport, name);
      subject.next({ type: "device-renamed", name });
      subject.complete();
    } catch (error) {
      subject.error({ type: "error", error });
    }
  };

  const innerSub = () => withDevice(deviceId)(transport => from(innerFn(transport)));

  innerSub()
    .pipe(
      catchError((error: Error) => {
        if (error.message === "not on dashboard" || error instanceof DisconnectedDevice) {
          // NOTE: from here, we have lost connection with the quitApp, and even though I
          // try to catch the DisconnectedDevice error, and restart an Observable using withDevice,
          // I cannot seem to "reconnect" to the device
          /*  eslint no-console: 0 */
          console.log(error);
          console.log("retrying");
          return innerSub().pipe(delay(1000));
        }

        return EMPTY;
      }),
    )
    .subscribe();

  return subject;

  // const sub: Observable<RenameDeviceEvent> = withDevice(deviceId)((transport): any => {
  //   const innerSub = () =>
  //     defer(() => from(getAppAndVersion(transport))).pipe(
  //       concatMap(appAndVersion => {
  //         if (!isDashboardName(appAndVersion.name)) {
  //           return concat(
  //             attemptToQuitApp(transport),
  //             of(<RenameDeviceEvent>{
  //               type: "attemptToQuitApp",
  //             }),
  //             innerSub(),
  //           );
  //         }

  //         return new Observable(o => {
  //           return concat(
  //             of(<RenameDeviceEvent>{
  //               type: "permission-requested",
  //             }),
  //             from(editDeviceName(transport, name)),
  //           )
  //             .pipe(
  //               map(e => e || { type: "device-renamed", name }),
  //               catchError((error: Error) =>
  //                 of({
  //                   type: "error",
  //                   error,
  //                 }),
  //               ),
  //             )
  //             .subscribe(e => o.next(e));
  //         });
  //       }),
  //     );

  //   return innerSub;
  // });

  // const sub = withDevice(deviceId)(transport =>
  //   defer(() => from(getAppAndVersion(transport))).pipe(
  //     switchMap(appAndVersion => {
  //       if (!isDashboardName(appAndVersion.name)) {
  //         return from(quitApp(transport)).pipe(
  //           switchMap(() => {
  //             throw new Error("not on dashboard");
  //           }),
  //         );
  //       }

  //       return concat(
  //         of(<RenameDeviceEvent>{
  //           type: "permission-requested",
  //         }),
  //         from(editDeviceName(transport, name)),
  //       );
  //     }),
  //   ),
  // ).pipe(retryWhileErrors((_e: Error) => true));

  // const sub = withDevice(deviceId)(transport =>
  //   defer(() => from(quitApp(transport)))
  //     .pipe(
  //       switchMap(() => {
  //         return from(getAppAndVersion(transport)).pipe(
  //           map(appAndVersion => {
  //             if (!isDashboardName(appAndVersion.name)) {
  //               throw new Error("not on dashboard");
  //             }

  //             return of(<RenameDeviceEvent>{
  //               type: "onDashboard",
  //             });
  //           }),
  //           retry({ delay: 500 }),
  //         );
  //       }),
  //     )
  //     .pipe(
  //       switchMap(() => {
  //         return new Observable(o => {
  //           const innerSub = concat(
  //             of(<RenameDeviceEvent>{
  //               type: "permission-requested",
  //             }),
  //             from(editDeviceName(transport, name)),
  //           )
  //             .pipe(
  //               map(e => e || { type: "device-renamed", name }),
  //               catchError((error: Error) =>
  //                 of({
  //                   type: "error",
  //                   error,
  //                 }),
  //               ),
  //             )
  //             .subscribe(e => o.next(e));

  //           return () => {
  //             innerSub.unsubscribe();
  //           };
  //         });
  //       }),
  //     ),
  // );

  // const renameAppFlow = withDevice(deviceId)(
  //   transport =>
  //     new Observable(o => {
  //       const innerSub = concat(
  //         of(<RenameDeviceEvent>{
  //           type: "permission-requested",
  //         }),
  //         from(editDeviceName(transport, name)),
  //       )
  //         .pipe(
  //           map(e => e || { type: "device-renamed", name }),
  //           catchError((error: Error) =>
  //             of({
  //               type: "error",
  //               error,
  //             }),
  //           ),
  //         )
  //         .subscribe(e => o.next(e));

  //       return () => {
  //         innerSub.unsubscribe();
  //       };
  //     }),
  // );

  // const sub = quitAppFlow.pipe(switchMap(_ => concat(renameAppFlow)));

  // return sub as Observable<RenameDeviceEvent>;
}
