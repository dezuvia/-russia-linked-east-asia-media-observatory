import { IconAlertCircle, IconLoader2 } from "@tabler/icons-react";
import { useI18n } from "../i18n";

export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="empty">
      <div className="empty-icon">
        <IconLoader2 className="spin" size={34} />
      </div>
      <p className="empty-title">{label ?? t("載入中", "Loading")}</p>
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  const { t } = useI18n();
  return (
    <div className="alert alert-danger" role="alert">
      <div className="d-flex">
        <div>
          <IconAlertCircle size={22} />
        </div>
        <div className="ms-2">
          <h4 className="alert-title">{t("資料載入失敗", "Data Load Failed")}</h4>
          <div className="text-secondary">{message}</div>
        </div>
      </div>
    </div>
  );
}
