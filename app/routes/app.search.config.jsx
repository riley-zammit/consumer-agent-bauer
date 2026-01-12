import { Form, useActionData, useLoaderData } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

function getAuthShop(authResult) {
  if (!authResult) return null;
  if (typeof authResult.shop === "string") return authResult.shop;
  if (authResult.session?.shop) return authResult.session.shop;
  return null;
}

function safeParseRules(rulesJson) {
  try {
    const parsed = JSON.parse(rulesJson || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function validateRules(rules) {
  if (!Array.isArray(rules)) return { ok: false, error: "Rules must be a JSON array." };
  if (rules.length > 100) return { ok: false, error: "Too many rules (max 100)." };

  for (const [i, r] of rules.entries()) {
    if (!r || typeof r !== "object") return { ok: false, error: `Rule ${i + 1} must be an object.` };
    if (!["vendor", "productType", "tags", "handle", "title"].includes(r.field)) {
      return { ok: false, error: `Rule ${i + 1}: invalid field.` };
    }
    if (!["equals", "contains", "starts_with"].includes(r.op)) {
      return { ok: false, error: `Rule ${i + 1}: invalid op.` };
    }
    if (typeof r.value !== "string") return { ok: false, error: `Rule ${i + 1}: value must be a string.` };
    const weight = Number(r.weight);
    if (!Number.isFinite(weight)) return { ok: false, error: `Rule ${i + 1}: weight must be a number.` };
    if (weight < -0.95 || weight > 10) return { ok: false, error: `Rule ${i + 1}: weight out of range.` };
    if (typeof r.enabled !== "boolean") return { ok: false, error: `Rule ${i + 1}: enabled must be boolean.` };
  }

  return { ok: true };
}

export async function loader({ request }) {
  const auth = await authenticate.admin(request);
  const shop = getAuthShop(auth);
  if (!shop) throw new Response("Missing shop", { status: 400 });

  const row = await prisma.searchBoostConfig.findUnique({ where: { shop } });
  const rulesJson = row?.rulesJson || "[]";

  return {
    shop,
    rulesJson,
    rules: safeParseRules(rulesJson),
  };
}

export async function action({ request }) {
  const auth = await authenticate.admin(request);
  const shop = getAuthShop(auth);
  if (!shop) throw new Response("Missing shop", { status: 400 });

  const formData = await request.formData();
  const rulesJson = (formData.get("rulesJson") || "").toString();

  const rules = safeParseRules(rulesJson);
  const validation = validateRules(rules);
  if (!validation.ok) {
    return { ok: false, error: validation.error, rulesJson };
  }

  await prisma.searchBoostConfig.upsert({
    where: { shop },
    create: { shop, rulesJson: JSON.stringify(rules) },
    update: { rulesJson: JSON.stringify(rules) },
  });

  return { ok: true };
}

export default function SearchConfigRoute() {
  const { shop, rulesJson } = useLoaderData();
  const actionData = useActionData();

  const textValue =
    (actionData && actionData.rulesJson) ||
    rulesJson ||
    JSON.stringify(
      [
        { field: "vendor", op: "equals", value: "Acme", weight: 0.5, enabled: true },
        { field: "tags", op: "contains", value: "bestseller", weight: 0.25, enabled: true },
      ],
      null,
      2
    );

  return (
    <s-page>
      <ui-title-bar title="Search boosts" />

      <s-section>
        <s-stack gap="base">
          <s-paragraph>
            Configure rule-based boosts for the demo local tool{" "}
            <s-text>search_products_preferred</s-text>. These rules only affect your
            shop: <s-text>{shop}</s-text>.
          </s-paragraph>

          <s-paragraph>
            Rules are JSON. Each rule is:
            <br />
            <code>
              {"{ field, op, value, weight, enabled }"}
            </code>
          </s-paragraph>

          {actionData?.ok === false ? (
            <div
              style={{
                padding: 12,
                border: "1px solid #cc0000",
                borderRadius: 8,
                background: "#fff5f5",
              }}
            >
              <s-paragraph>{actionData.error}</s-paragraph>
            </div>
          ) : null}

          {actionData?.ok === true ? (
            <div
              style={{
                padding: 12,
                border: "1px solid #0a7a0a",
                borderRadius: 8,
                background: "#f1fff1",
              }}
            >
              <s-paragraph>Saved.</s-paragraph>
            </div>
          ) : null}

          <Form method="post">
            <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
              <label>
                <s-text emphasis="strong">Boost rules (JSON)</s-text>
                <textarea
                  name="rulesJson"
                  defaultValue={textValue}
                  rows={18}
                  style={{
                    width: "100%",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: 12,
                    padding: 12,
                    border: "1px solid #d9d9d9",
                    borderRadius: 8,
                  }}
                />
              </label>

              <div>
                <button type="submit">Save</button>
              </div>
            </div>
          </Form>
        </s-stack>
      </s-section>
    </s-page>
  );
}


