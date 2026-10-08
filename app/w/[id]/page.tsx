import WorkspaceShell from "@/components/workspace/WorkspaceShell";

export default async function WorkspacePage(props: PageProps<"/w/[id]">) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  // Arriving straight from "Create workspace" opens the QR dialog.
  return <WorkspaceShell workspaceId={id} openShare={query.share === "1"} />;
}
