// Example: Merge descriptors from multiple generated services

import { toolDescriptors as orderDescriptors } from "./generated/order-api/tool-descriptors.gen";
import { toolDescriptors as productDescriptors } from "./generated/product-api/tool-descriptors.gen";
import { toolDescriptors as userDescriptors } from "./generated/user-api/tool-descriptors.gen";

export const allDescriptors = [
  ...userDescriptors,
  ...orderDescriptors,
  ...productDescriptors,
];

export const allDescriptorMap = Object.fromEntries(
  allDescriptors.map((descriptor) => [descriptor.toolName, descriptor])
);
