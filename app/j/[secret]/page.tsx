import JoinBySecret from "@/components/JoinBySecret";

export default async function JoinPage(props: PageProps<"/j/[secret]">) {
  const { secret } = await props.params;
  return <JoinBySecret secret={secret} />;
}
