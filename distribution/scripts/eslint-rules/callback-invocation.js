/**
 * @fileoverview Ensure callback parameters are invoked or forwarded.
 */

'use strict';

const CALLBACK_NAMES = new Set(['callback', 'cb', 'done', 'next']);

function isCallExpressionWithCallee(node, identifier) {
  if (!node) {
    return false;
  }

  if (node.type === 'CallExpression' && node.callee === identifier) {
    return true;
  }

  if (node.type === 'ChainExpression' &&
      node.expression &&
      node.expression.type === 'CallExpression' &&
      node.expression.callee === identifier) {
    return true;
  }

  return false;
}

function isPassedAsArgument(node, identifier) {
  if (!node) {
    return false;
  }

  if (node.type === 'CallExpression' || node.type === 'NewExpression') {
    return node.arguments.includes(identifier);
  }

  return false;
}

function usesCallback(reference) {
  const identifier = reference.identifier;
  if (!identifier || !identifier.parent) {
    return false;
  }

  if (isCallExpressionWithCallee(identifier.parent, identifier)) {
    return true;
  }

  if (isPassedAsArgument(identifier.parent, identifier)) {
    return true;
  }

  return false;
}

function checkFunction(context, node) {
  if (!node.params || node.params.length === 0) {
    return;
  }

  const callbackParams = node.params.filter((param) =>
    param.type === 'Identifier' && CALLBACK_NAMES.has(param.name));

  if (callbackParams.length === 0) {
    return;
  }

  const variables = context.getDeclaredVariables(node);
  for (const param of callbackParams) {
    const variable = variables.find((item) => item.name === param.name);
    if (!variable) {
      continue;
    }

    const invoked = variable.references.some(usesCallback);
    if (!invoked) {
      context.report({
        node: param,
        message:
          `Expected callback parameter "${param.name}" to be invoked or forwarded.`,
      });
    }
  }
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require callback parameters to be invoked or forwarded.',
    },
    schema: [],
  },
  create(context) {
    return {
      FunctionDeclaration(node) {
        checkFunction(context, node);
      },
      FunctionExpression(node) {
        checkFunction(context, node);
      },
      ArrowFunctionExpression(node) {
        checkFunction(context, node);
      },
    };
  },
};
