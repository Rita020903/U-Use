import "./globals.css";
import ConfirmationProvider from "../components/ConfirmationProvider";

export const metadata = {
  title: "U Use | 西浦物品使用平台",
  description: "面向西交利物浦大学学生的买断、借用、短租与交换平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ConfirmationProvider>{children}</ConfirmationProvider>
      </body>
    </html>
  );
}
