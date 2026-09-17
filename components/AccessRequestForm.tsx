"use client";

import ContactForm from "./ContactForm";

// Pedido de acesso de agência (cadastro público fechado por AGENCY_SELF_SIGNUP).
export default function AccessRequestForm() {
  return <ContactForm kind="access_request" initialTopic="acesso" />;
}
